/**
 * End-to-End Verification Script against live TropicStay API + MongoDB + SSE Real-Time Stream.
 * Cleans up all temporary test records from MongoDB at the end.
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const Chalet = require('../models/Chalet');
const Booking = require('../models/Booking');
const Message = require('../models/Message');

const API = process.env.API_URL || 'http://127.0.0.1:5000/api';

async function apiCall(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

class SseRecorder {
  constructor(token) {
    this.token = token;
    this.events = [];
    this.controller = new AbortController();
    this.readyPromise = null;
  }

  start() {
    this.readyPromise = (async () => {
      const endpoint = this.token
        ? `${API}/events/stream?token=${encodeURIComponent(this.token)}`
        : `${API}/events/public-stream`;
      const res = await fetch(endpoint, {
        signal: this.controller.signal,
      });
      if (!res.ok) throw new Error(`SSE HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let resolveConnected;
      const connectedPromise = new Promise((resolve) => {
        resolveConnected = resolve;
      });

      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const blocks = buffer.split('\n\n');
            buffer = blocks.pop() || '';
            for (const block of blocks) {
              if (!block.trim() || block.startsWith(':')) continue;
              const lines = block.split('\n');
              let eventName = 'message';
              let dataStr = '';
              for (const line of lines) {
                if (line.startsWith('event: ')) eventName = line.slice(7).trim();
                if (line.startsWith('data: ')) dataStr += line.slice(6);
              }
              const parsed = dataStr ? JSON.parse(dataStr) : {};
              this.events.push({ event: eventName, data: parsed });
              if (eventName === 'connected') resolveConnected();
            }
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('SSE read error:', err.message);
          }
        }
      })();

      await Promise.race([
        connectedPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SSE connect timeout')), 5000)),
      ]);
    })();
    return this.readyPromise;
  }

  async waitForEvent(predicate, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = this.events.find(predicate);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`Timeout waiting for SSE event. Received: ${JSON.stringify(this.events.map((e) => e.event))}`);
  }

  stop() {
    this.controller.abort();
  }
}

async function run() {
  const stamp = Date.now();
  const ownerEmail = `e2e.owner.${stamp}@tropicstay.test`;
  const guestEmail = `e2e.guest.${stamp}@tropicstay.test`;
  const createdIds = { ownerId: null, guestId: null, chaletId: null };
  let ownerSse = null;
  let guestSse = null;
  let publicSse = null;

  try {
    console.log('1. Verificando salud del servidor y MongoDB...');
    const health = await apiCall('/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.database, 'connected');

    console.log('2. Registrando Propietario y Huésped...');
    const regOwner = await apiCall('/auth/register', {
      method: 'POST',
      body: {
        name: 'Propietario Prueba E2E',
        email: ownerEmail,
        password: 'Password123!',
        phone: '+502 5500-1111',
        role: 'host',
      },
    });
    assert.equal(regOwner.status, 201);
    const ownerToken = regOwner.data.token;
    createdIds.ownerId = regOwner.data.user._id;

    const regGuest = await apiCall('/auth/register', {
      method: 'POST',
      body: {
        name: 'Huésped Prueba E2E',
        email: guestEmail,
        password: 'Password123!',
        phone: '+502 5500-2222',
        role: 'guest',
      },
    });
    assert.equal(regGuest.status, 201);
    createdIds.guestId = regGuest.data.user._id;

    console.log('3. Verificando inicio de sesión con correo y contraseña...');
    const loginGuest = await apiCall('/auth/login', {
      method: 'POST',
      body: { email: guestEmail, password: 'Password123!' },
    });
    assert.equal(loginGuest.status, 200);
    const guestToken = loginGuest.data.token;

    console.log('4. Conectando streams SSE en tiempo real para Propietario y Huésped...');
    ownerSse = new SseRecorder(ownerToken);
    guestSse = new SseRecorder(guestToken);
    await Promise.all([ownerSse.start(), guestSse.start()]);

    console.log('5. Publicando chalet en MongoDB...');
    const createChalet = await apiCall('/chalets', {
      method: 'POST',
      token: ownerToken,
      body: {
        title: `Chalet E2E Atitlán ${stamp}`,
        category: 'Lago',
        department: 'Sololá',
        municipality: 'Panajachel',
        location: ['Lago de Atitlán'],
        description: 'Chalet de prueba E2E con muelle privado.',
        pricePerNight: 1800,
        cleaningFee: 150,
        guestsMax: 6,
        bedrooms: 3,
        beds: 3,
        bathrooms: 2,
        images: ['https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=80'],
        coordinates: { lat: 14.7409, lng: -91.1591 },
      },
    });
    assert.equal(createChalet.status, 201);
    createdIds.chaletId = createChalet.data.data._id;

    console.log('6. Verificar que el chat está bloqueado antes de aceptar la cita (403)...');
    const blockedBeforeCita = await apiCall('/messages', {
      method: 'POST',
      token: guestToken,
      body: {
        recipientId: createdIds.ownerId,
        chaletId: createdIds.chaletId,
        content: 'Hola, intento escribir sin cita.',
      },
    });
    assert.equal(blockedBeforeCita.status, 403);
    assert.equal(blockedBeforeCita.data.code, 'APPOINTMENT_NOT_ACCEPTED');

    console.log('7. Huésped pide una CITA/VISITA -> verificar DB + SSE en tiempo real al Propietario (chat aún bloqueado)...');
    const createCita = await apiCall('/bookings', {
      method: 'POST',
      token: guestToken,
      body: {
        chaletId: createdIds.chaletId,
        bookingType: 'cita',
        visitTime: '11:30 AM',
        status: 'pendiente',
        guestName: 'Huésped Prueba E2E',
        guestEmail,
        guestPhone: '+502 5500-2222',
        checkIn: '2027-09-10',
        guestsCount: 2,
        notes: 'Cita para ver el chalet',
      },
    });
    assert.equal(createCita.status, 201);
    const citaId = createCita.data.data._id;

    const ownerReceivedCita = await ownerSse.waitForEvent(
      (e) => e.event === 'booking:created' && e.data?.booking?._id === citaId
    );
    assert.equal(ownerReceivedCita.data.booking.bookingType, 'cita');
    assert.equal(ownerReceivedCita.data.booking.status, 'pendiente');

    const blockedWhilePending = await apiCall('/messages', {
      method: 'POST',
      token: guestToken,
      body: {
        recipientId: createdIds.ownerId,
        chaletId: createdIds.chaletId,
        content: '¿Ya me aceptaste la cita?',
      },
    });
    assert.equal(blockedWhilePending.status, 403);

    console.log('8. Propietario ACEPTA la cita -> verificar habilitación del chat en tiempo real y envío de mensaje...');
    const acceptCita = await apiCall(`/bookings/${citaId}/status`, {
      method: 'PATCH',
      token: ownerToken,
      body: { status: 'confirmada' },
    });
    assert.equal(acceptCita.status, 200);
    assert.equal(acceptCita.data.data.status, 'confirmada');

    await guestSse.waitForEvent(
      (e) => e.event === 'booking:updated' && e.data?.booking?._id === citaId && e.data?.booking?.status === 'confirmada'
    );

    const eligibility = await apiCall(`/messages/eligibility/${createdIds.ownerId}?chaletId=${createdIds.chaletId}`, {
      token: guestToken,
    });
    assert.equal(eligibility.status, 200);
    assert.equal(eligibility.data.data.chatEnabled, true);
    assert.equal(eligibility.data.data.appointmentStatus, 'confirmada');

    const sendMsg = await apiCall('/messages', {
      method: 'POST',
      token: guestToken,
      body: {
        recipientId: createdIds.ownerId,
        chaletId: createdIds.chaletId,
        content: '¡Gracias por aceptar la cita! Nos vemos a las 11:30 AM.',
      },
    });
    assert.equal(sendMsg.status, 201);

    const ownerReceivedMsg = await ownerSse.waitForEvent(
      (e) => e.event === 'message:new' && e.data?.message?._id === sendMsg.data.data._id
    );
    assert.equal(ownerReceivedMsg.data.message.isMine, false);

    console.log('9. Huésped solicita ALQUILAR el chalet -> verificar DB, bloqueo de fechas y SSE en tiempo real al Propietario...');
    const createRental = await apiCall('/bookings', {
      method: 'POST',
      token: guestToken,
      body: {
        chaletId: createdIds.chaletId,
        bookingType: 'reserva',
        status: 'pendiente',
        guestName: 'Huésped Prueba E2E',
        guestEmail,
        guestPhone: '+502 5500-2222',
        checkIn: '2027-09-20',
        checkOut: '2027-09-23',
        guestsCount: 4,
        notes: 'Queremos alquilar 3 noches',
      },
    });
    assert.equal(createRental.status, 201);
    const rentalId = createRental.data.data._id;

    const ownerReceivedRental = await ownerSse.waitForEvent(
      (e) => e.event === 'booking:created' && e.data?.booking?._id === rentalId
    );
    assert.equal(ownerReceivedRental.data.booking.totalPriceGTQ, 5550);

    // Verificar fechas bloqueadas en detalle del chalet
    const chaletDetail = await apiCall(`/chalets/${createdIds.chaletId}`);
    assert.equal(chaletDetail.status, 200);
    assert.equal(chaletDetail.data.data.bookedDates.some((d) => d._id === rentalId), true);

    console.log('10. Propietario consulta sus solicitudes, responde mensaje y confirma reserva -> verificar SSE al Huésped...');
    const ownerSummary = await apiCall('/bookings/summary', { token: ownerToken });
    assert.equal(ownerSummary.data.data.pendingHostCount, 1);

    const confirmRental = await apiCall(`/bookings/${rentalId}/status`, {
      method: 'PATCH',
      token: ownerToken,
      body: { status: 'confirmada' },
    });
    assert.equal(confirmRental.status, 200);
    assert.equal(confirmRental.data.data.status, 'confirmada');

    const guestReceivedConfirm = await guestSse.waitForEvent(
      (e) => e.event === 'booking:updated' && e.data?.booking?._id === rentalId && e.data?.booking?.status === 'confirmada'
    );
    assert.equal(guestReceivedConfirm.data.booking.status, 'confirmada');

    const ownerReply = await apiCall('/messages', {
      method: 'POST',
      token: ownerToken,
      body: {
        recipientId: createdIds.guestId,
        chaletId: createdIds.chaletId,
        content: '¡Con gusto! Tu reserva quedó confirmada y te esperamos.',
      },
    });
    assert.equal(ownerReply.status, 201);

    await guestSse.waitForEvent(
      (e) => e.event === 'message:new' && e.data?.message?._id === ownerReply.data.data._id
    );

    // Verificar persistencia completa de mensajes en MongoDB
    const conv = await apiCall(`/messages/with/${createdIds.ownerId}`, { token: guestToken });
    assert.equal(conv.status, 200);
    assert.ok(conv.data.data.messages.length >= 4, 'Deben persistir mensajes manuales y automáticos en MongoDB');

    console.log('11. Cambio de estado del chalet (disponible / reservado / mantenimiento) en tiempo real para huésped y visitante público...');
    publicSse = new SseRecorder(null);
    await publicSse.start();

    for (const nextStatus of ['reservado', 'mantenimiento', 'disponible']) {
      const statusRes = await apiCall(`/chalets/${createdIds.chaletId}`, {
        method: 'PUT',
        token: ownerToken,
        body: { status: nextStatus },
      });
      assert.equal(statusRes.status, 200);
      assert.equal(statusRes.data.data.status, nextStatus);

      const guestChaletEvent = await guestSse.waitForEvent(
        (e) =>
          e.event === 'chalet:updated' &&
          e.data?.chalet?._id === createdIds.chaletId &&
          e.data?.chalet?.status === nextStatus
      );
      assert.equal(guestChaletEvent.data.chalet.status, nextStatus);

      const publicChaletEvent = await publicSse.waitForEvent(
        (e) =>
          e.event === 'chalet:updated' &&
          e.data?.chalet?._id === createdIds.chaletId &&
          e.data?.chalet?.status === nextStatus
      );
      assert.equal(publicChaletEvent.data.chalet.status, nextStatus);
    }

    console.log('E2E FLUJO COMPLETO + TIEMPO REAL VERIFICADO AL 100% ✅');
  } finally {
    ownerSse?.stop();
    guestSse?.stop();
    publicSse?.stop();

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tropicstay_db');
    if (createdIds.chaletId) {
      await Booking.deleteMany({ chalet: createdIds.chaletId });
      await Message.deleteMany({
        $or: [
          { chalet: createdIds.chaletId },
          { sender: { $in: [createdIds.ownerId, createdIds.guestId].filter(Boolean) } },
          { recipient: { $in: [createdIds.ownerId, createdIds.guestId].filter(Boolean) } },
        ],
      });
      await Chalet.deleteOne({ _id: createdIds.chaletId });
    }
    if (createdIds.ownerId || createdIds.guestId) {
      await User.deleteMany({ _id: { $in: [createdIds.ownerId, createdIds.guestId].filter(Boolean) } });
    }
    await mongoose.connection.close();
  }
}

run().catch((err) => {
  console.error('E2E FALLÓ:', err);
  process.exitCode = 1;
});

