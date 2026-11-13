const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const bookingController = require('../controllers/bookingController');
const Booking = require('../models/Booking');
const Chalet = require('../models/Chalet');
const Message = require('../models/Message');
const realtimeService = require('../services/realtimeService');

const {
  validId,
  parseBookingDate,
  toDateOnlyString,
  calculateBookingPricing,
  validateBookingInput,
  isBookingOwner,
  isChaletOwner,
  canAccess,
} = bookingController._helpers;

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('Módulo de Reservaciones - Pruebas Unitarias de Helpers y Validaciones', () => {
  it('valida identificadores ObjectId correctamente con validId()', () => {
    const id = new mongoose.Types.ObjectId().toString();
    assert.equal(validId(id), true);
    assert.equal(validId('id-invalido'), false);
    assert.equal(validId(''), false);
    assert.equal(validId(null), false);
  });

  it('parseBookingDate() convierte fechas válidas y rechaza fechas inexistentes en el calendario', () => {
    const valid = parseBookingDate('2027-05-15');
    assert.equal(Number.isNaN(valid.getTime()), false);
    assert.equal(toDateOnlyString(valid), '2027-05-15');

    // Fecha con formato ISO completo
    const fromIso = parseBookingDate('2027-08-20T00:00:00.000Z');
    assert.equal(toDateOnlyString(fromIso), '2027-08-20');

    // 31 de febrero no existe (no debe hacer rollover a marzo)
    const invalidRollover = parseBookingDate('2027-02-31');
    assert.equal(Number.isNaN(invalidRollover.getTime()), true);

    assert.equal(Number.isNaN(parseBookingDate('texto').getTime()), true);
  });

  it('calculateBookingPricing() calcula noches, tarifa de limpieza y total en GTQ', () => {
    const start = parseBookingDate('2027-06-10');
    const end = parseBookingDate('2027-06-13');

    const pricing = calculateBookingPricing(start, end, 1500, 200);
    assert.equal(pricing.nights, 3);
    assert.equal(pricing.cleaningFee, 200);
    assert.equal(pricing.totalPriceGTQ, 4700);

    // Respeta cleaningFee = 0 cuando el chalet no cobra limpieza
    const zeroCleaning = calculateBookingPricing(start, end, 1000, 0);
    assert.equal(zeroCleaning.cleaningFee, 0);
    assert.equal(zeroCleaning.totalPriceGTQ, 3000);
  });

  it('validateBookingInput() valida campos obligatorios, correo, teléfono, fechas y capacidad', () => {
    const chalet = { guestsMax: 6 };
    const now = parseBookingDate('2027-01-10');

    // Caso válido
    const ok = validateBookingInput({
      guestName: 'María López',
      guestEmail: 'maria@example.com',
      guestPhone: '+502 5555-1234',
      checkIn: '2027-01-15',
      checkOut: '2027-01-18',
      guestsCount: 4,
      chalet,
      now,
    });
    assert.equal(ok.valid, true);
    assert.equal(ok.guestsCount, 4);

    // Correo inválido
    const badEmail = validateBookingInput({
      guestName: 'María López',
      guestEmail: 'correo-sin-formato',
      guestPhone: '+502 5555-1234',
      checkIn: '2027-01-15',
      checkOut: '2027-01-18',
      guestsCount: 2,
      chalet,
      now,
    });
    assert.equal(badEmail.valid, false);
    assert.match(badEmail.message, /correo/i);

    // Teléfono muy corto
    const badPhone = validateBookingInput({
      guestName: 'María López',
      guestEmail: 'maria@example.com',
      guestPhone: '123',
      checkIn: '2027-01-15',
      checkOut: '2027-01-18',
      guestsCount: 2,
      chalet,
      now,
    });
    assert.equal(badPhone.valid, false);
    assert.match(badPhone.message, /teléfono/i);

    // Fecha de salida anterior o igual a la llegada
    const badDates = validateBookingInput({
      guestName: 'María López',
      guestEmail: 'maria@example.com',
      guestPhone: '+502 5555-1234',
      checkIn: '2027-01-18',
      checkOut: '2027-01-15',
      guestsCount: 2,
      chalet,
      now,
    });
    assert.equal(badDates.valid, false);
    assert.match(badDates.message, /fechas/i);

    // Exceso de huéspedes
    const tooManyGuests = validateBookingInput({
      guestName: 'María López',
      guestEmail: 'maria@example.com',
      guestPhone: '+502 5555-1234',
      checkIn: '2027-01-15',
      checkOut: '2027-01-18',
      guestsCount: 10,
      chalet,
      now,
    });
    assert.equal(tooManyGuests.valid, false);
    assert.match(tooManyGuests.message, /1 a 6 huéspedes/);
  });

  it('verifica permisos de acceso (isBookingOwner, isChaletOwner, canAccess)', () => {
    const guestId = new mongoose.Types.ObjectId();
    const hostId = new mongoose.Types.ObjectId();
    const strangerId = new mongoose.Types.ObjectId();

    const booking = {
      guest: { _id: guestId },
      chalet: { host: { _id: hostId } },
    };

    assert.equal(isBookingOwner(booking, { _id: guestId, role: 'guest' }), true);
    assert.equal(isBookingOwner(booking, { _id: hostId, role: 'host' }), false);
    assert.equal(isChaletOwner(booking, { _id: hostId, role: 'host' }), true);
    assert.equal(canAccess(booking, { _id: guestId, role: 'guest' }), true);
    assert.equal(canAccess(booking, { _id: hostId, role: 'host' }), true);
    assert.equal(canAccess(booking, { _id: strangerId, role: 'guest' }), false);
    assert.equal(canAccess(booking, { _id: strangerId, role: 'admin' }), true);
  });
});

describe('Módulo de Reservaciones - Pruebas Unitarias del Controlador (bookingController)', () => {
  const originals = {};

  beforeEach(() => {
    originals.chaletFindById = Chalet.findById;
    originals.chaletFind = Chalet.find;
    originals.bookingExists = Booking.exists;
    originals.bookingCreate = Booking.create;
    originals.bookingFindById = Booking.findById;
    originals.bookingFind = Booking.find;
    originals.messageCreate = Message.create;
  });

  afterEach(() => {
    Chalet.findById = originals.chaletFindById;
    Chalet.find = originals.chaletFind;
    Booking.exists = originals.bookingExists;
    Booking.create = originals.bookingCreate;
    Booking.findById = originals.bookingFindById;
    Booking.find = originals.bookingFind;
    Message.create = originals.messageCreate;
  });

  it('createBooking() rechaza reservar el propio chalet del anfitrión (400)', async () => {
    const hostId = new mongoose.Types.ObjectId();
    const chaletId = new mongoose.Types.ObjectId();

    Chalet.findById = async () => ({
      _id: chaletId,
      host: hostId,
      status: 'disponible',
      guestsMax: 4,
    });

    const req = {
      user: { _id: hostId, role: 'host' },
      body: {
        chaletId: chaletId.toString(),
        guestName: 'Host User',
        guestEmail: 'host@tropicstay.gt',
        guestPhone: '+502 5555-9999',
        checkIn: '2027-12-01',
        checkOut: '2027-12-03',
        guestsCount: 2,
      },
    };
    const res = createMockRes();

    await bookingController.createBooking(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /propio chalet/i);
  });

  it('createBooking() rechaza chalets en mantenimiento (400)', async () => {
    const hostId = new mongoose.Types.ObjectId();
    const guestId = new mongoose.Types.ObjectId();
    const chaletId = new mongoose.Types.ObjectId();

    Chalet.findById = async () => ({
      _id: chaletId,
      host: hostId,
      status: 'mantenimiento',
      guestsMax: 4,
    });

    const req = {
      user: { _id: guestId, role: 'guest' },
      body: {
        chaletId: chaletId.toString(),
        guestName: 'Guest User',
        guestEmail: 'guest@tropicstay.gt',
        guestPhone: '+502 5555-1111',
        checkIn: '2027-12-01',
        checkOut: '2027-12-03',
        guestsCount: 2,
      },
    };
    const res = createMockRes();

    await bookingController.createBooking(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /mantenimiento/i);
  });

  it('createBooking() detecta traslape de fechas y devuelve 409 Conflict', async () => {
    const hostId = new mongoose.Types.ObjectId();
    const guestId = new mongoose.Types.ObjectId();
    const chaletId = new mongoose.Types.ObjectId();

    Chalet.findById = async () => ({
      _id: chaletId,
      host: hostId,
      status: 'disponible',
      guestsMax: 6,
      pricePerNight: 1200,
      cleaningFee: 150,
    });
    Booking.exists = async () => ({ _id: new mongoose.Types.ObjectId() });

    const req = {
      user: { _id: guestId, role: 'guest' },
      body: {
        chaletId: chaletId.toString(),
        guestName: 'Juan Pérez',
        guestEmail: 'juan@tropicstay.gt',
        guestPhone: '+502 4444-3333',
        checkIn: '2027-12-10',
        checkOut: '2027-12-12',
        guestsCount: 3,
      },
    };
    const res = createMockRes();

    await bookingController.createBooking(req, res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /ya tiene una reserva/i);
  });

  it('createBooking() crea la reserva (201) y envía mensaje automático al chat del anfitrión', async () => {
    const hostId = new mongoose.Types.ObjectId();
    const guestId = new mongoose.Types.ObjectId();
    const chaletId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();

    let createdBookingPayload = null;
    let createdChatMessage = null;

    Chalet.findById = async () => ({
      _id: chaletId,
      title: 'Chalet Vista al Lago',
      host: hostId,
      status: 'disponible',
      guestsMax: 6,
      pricePerNight: 2000,
      cleaningFee: 200,
    });
    Booking.exists = async () => null;
    Booking.create = async (payload) => {
      createdBookingPayload = payload;
      return { _id: bookingId, ...payload };
    };
    Booking.findById = () => ({
      populate() {
        return {
          populate: async () => ({
            _id: bookingId,
            ...createdBookingPayload,
          }),
        };
      },
    });
    Message.create = async (msgPayload) => {
      createdChatMessage = msgPayload;
      return msgPayload;
    };

    const req = {
      user: { _id: guestId, role: 'guest', phone: '+502 5555-0000', save: async () => {} },
      body: {
        chaletId: chaletId.toString(),
        guestName: 'Ana Gómez',
        guestEmail: 'ana@tropicstay.gt',
        guestPhone: '+502 5888-7777',
        checkIn: '2027-12-20',
        checkOut: '2027-12-23',
        guestsCount: 4,
        notes: 'Llegamos a las 15:00 hrs',
      },
    };
    const res = createMockRes();

    await bookingController.createBooking(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(createdBookingPayload.nights, 3);
    assert.equal(createdBookingPayload.totalPriceGTQ, 6200);
    assert.equal(createdBookingPayload.status, 'confirmada');
    assert.ok(createdChatMessage, 'Debe crear mensaje automático para el anfitrión');
    assert.equal(String(createdChatMessage.sender), String(guestId));
    assert.equal(String(createdChatMessage.recipient), String(hostId));
    assert.equal(String(createdChatMessage.chalet), String(chaletId));
    assert.match(createdChatMessage.content, /Chalet Vista al Lago/);
    assert.match(createdChatMessage.content, /Llegamos a las 15:00 hrs/);
  });

  it('updateBookingStatus() impide que el huésped confirme una reserva (403), pero le permite cancelarla (200)', async () => {
    const hostId = new mongoose.Types.ObjectId();
    const guestId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();

    const mockBookingDoc = {
      _id: bookingId,
      guest: { _id: guestId },
      chalet: { _id: new mongoose.Types.ObjectId(), title: 'Chalet Sololá', host: { _id: hostId } },
      checkIn: new Date(2027, 10, 10),
      checkOut: new Date(2027, 10, 12),
      status: 'pendiente',
      save: async function () {
        return this;
      },
    };

    Booking.findById = () => ({
      populate() {
        return {
          populate: async () => mockBookingDoc,
        };
      },
    });
    Message.create = async () => ({});

    // 1. Huésped intenta confirmar -> 403
    const reqConfirm = {
      params: { id: bookingId.toString() },
      body: { status: 'confirmada' },
      user: { _id: guestId, role: 'guest' },
    };
    const resConfirm = createMockRes();
    await bookingController.updateBookingStatus(reqConfirm, resConfirm);
    assert.equal(resConfirm.statusCode, 403);

    // 2. Huésped cancela -> 200
    const reqCancel = {
      params: { id: bookingId.toString() },
      body: { status: 'cancelada' },
      user: { _id: guestId, role: 'guest' },
    };
    const resCancel = createMockRes();
    await bookingController.updateBookingStatus(reqCancel, resCancel);
    assert.equal(resCancel.statusCode, 200);
    assert.equal(mockBookingDoc.status, 'cancelada');
  });

  it('updateBookingStatus() impide reactivar una reserva cancelada si las fechas ya fueron ocupadas (409)', async () => {
    const hostId = new mongoose.Types.ObjectId();
    const guestId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();
    const chaletId = new mongoose.Types.ObjectId();

    const mockBookingDoc = {
      _id: bookingId,
      guest: { _id: guestId },
      chalet: { _id: chaletId, title: 'Chalet Atitlán', host: { _id: hostId } },
      checkIn: new Date(2027, 10, 10),
      checkOut: new Date(2027, 10, 12),
      status: 'cancelada',
      save: async function () {
        return this;
      },
    };

    Booking.findById = () => ({
      populate() {
        return {
          populate: async () => mockBookingDoc,
        };
      },
    });
    Booking.exists = async () => ({ _id: new mongoose.Types.ObjectId() });

    const req = {
      params: { id: bookingId.toString() },
      body: { status: 'confirmada' },
      user: { _id: hostId, role: 'host' },
    };
    const res = createMockRes();

    await bookingController.updateBookingStatus(req, res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.message, /ya están ocupadas/i);
  });

  it('createBooking() permite pedir una cita/visita (bookingType: "cita") y notifica en tiempo real al propietario', async () => {
    const hostId = new mongoose.Types.ObjectId();
    const guestId = new mongoose.Types.ObjectId();
    const chaletId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();

    let createdPayload = null;
    const emittedEvents = [];
    const originalEmit = realtimeService.emitToUser;
    realtimeService.emitToUser = (userId, event, data) => {
      emittedEvents.push({ userId: String(userId), event, data });
      return 1;
    };

    try {
      Chalet.findById = async () => ({
        _id: chaletId,
        title: 'Chalet Vista al Lago',
        host: hostId,
        status: 'disponible',
        guestsMax: 6,
        pricePerNight: 2000,
        cleaningFee: 200,
      });
      Booking.create = async (payload) => {
        createdPayload = payload;
        return { _id: bookingId, ...payload };
      };
      Booking.findById = () => ({
        populate() {
          return {
            populate: async () => ({
              _id: bookingId,
              ...createdPayload,
              chalet: { _id: chaletId, title: 'Chalet Vista al Lago', host: { _id: hostId } },
              guest: { _id: guestId, name: 'Ana Gómez' },
            }),
          };
        },
      });
      Message.create = async (msgPayload) => ({
        ...msgPayload,
        toObject: () => msgPayload,
      });

      const req = {
        user: { _id: guestId, role: 'guest', phone: '+502 5888-7777', save: async () => {} },
        body: {
          chaletId: chaletId.toString(),
          bookingType: 'cita',
          visitTime: '11:00 AM',
          guestName: 'Ana Gómez',
          guestEmail: 'ana@tropicstay.gt',
          guestPhone: '+502 5888-7777',
          checkIn: '2027-12-20',
          guestsCount: 2,
          notes: 'Quiero conocer la propiedad antes de alquilar',
        },
      };
      const res = createMockRes();

      await bookingController.createBooking(req, res);

      assert.equal(res.statusCode, 201);
      assert.equal(createdPayload.bookingType, 'cita');
      assert.equal(createdPayload.visitTime, '11:00 AM');
      assert.equal(createdPayload.nights, 0);
      assert.equal(createdPayload.totalPriceGTQ, 0);
      assert.equal(createdPayload.status, 'pendiente');

      const hostBookingEvent = emittedEvents.find((e) => e.userId === String(hostId) && e.event === 'booking:created');
      const hostMessageEvent = emittedEvents.find((e) => e.userId === String(hostId) && e.event === 'message:new');
      assert.ok(hostBookingEvent, 'El propietario debe recibir booking:created en tiempo real');
      assert.ok(hostMessageEvent, 'El propietario debe recibir message:new en tiempo real');
    } finally {
      realtimeService.emitToUser = originalEmit;
    }
  });
});

