const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Chalet = require('../models/Chalet');
const Message = require('../models/Message');
const realtimeService = require('../services/realtimeService');

const VALID_STATUSES = ['confirmada', 'pendiente', 'cancelada'];
const VALID_BOOKING_TYPES = ['reserva', 'cita'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLIC_USER_FIELDS = 'name email phone avatar role verified superhost responseTime';
const PUBLIC_CHALET_FIELDS = 'title thumbnail pricePerNight priceUSD municipality department';

const validId = (id) => Boolean(id && mongoose.Types.ObjectId.isValid(id));

function parseBookingDate(value) {
  if (!value) return new Date(NaN);
  const datePart = String(value).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return new Date(NaN);
  const [year, month, day] = datePart.split('-').map(Number);
  const dt = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return new Date(NaN);
  }
  return dt;
}

function toDateOnlyString(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput.trim())) {
    return dateInput.trim().slice(0, 10);
  }
  const dt = new Date(dateInput);
  if (Number.isNaN(dt.getTime())) return '';
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateBookingPricing(start, end, pricePerNight, cleaningFee = 150) {
  const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const resolvedCleaningFee = cleaningFee ?? 150;
  const totalPriceGTQ = (nights * Number(pricePerNight)) + Number(resolvedCleaningFee);
  return { nights, cleaningFee: Number(resolvedCleaningFee), totalPriceGTQ };
}

function validateBookingInput({
  guestName,
  guestEmail,
  guestPhone,
  checkIn,
  checkOut,
  guestsCount,
  chalet,
  bookingType = 'reserva',
  visitTime = '',
  now = new Date(),
}) {
  if (!guestName?.trim() || !guestEmail?.trim() || !guestPhone?.trim()) {
    return { valid: false, message: 'Nombre, correo y teléfono son obligatorios.' };
  }
  if (!EMAIL_REGEX.test(guestEmail.trim())) {
    return { valid: false, message: 'El formato del correo electrónico no es válido.' };
  }
  const phoneDigits = guestPhone.replace(/\D/g, '');
  if (phoneDigits.length < 7) {
    return { valid: false, message: 'El número de teléfono debe tener al menos 7 dígitos.' };
  }

  const start = parseBookingDate(checkIn);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (bookingType === 'cita') {
    if (Number.isNaN(start.getTime()) || start < today) {
      return { valid: false, message: 'Selecciona una fecha válida desde hoy para la cita.' };
    }
    const cleanVisitTime = typeof visitTime === 'string' && visitTime.trim() ? visitTime.trim() : '10:00 AM';
    const parsedGuests = Number(guestsCount || 1);
    const maxGuests = chalet?.guestsMax || 1;
    if (!Number.isInteger(parsedGuests) || parsedGuests < 1 || parsedGuests > maxGuests) {
      return { valid: false, message: `El chalet admite de 1 a ${maxGuests} huéspedes.` };
    }
    return { valid: true, start, end: start, guestsCount: parsedGuests, visitTime: cleanVisitTime };
  }

  const end = parseBookingDate(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start < today || end <= start) {
    return { valid: false, message: 'Las fechas de reserva no son válidas.' };
  }

  const parsedGuests = Number(guestsCount);
  const maxGuests = chalet?.guestsMax || 1;
  if (!Number.isInteger(parsedGuests) || parsedGuests < 1 || parsedGuests > maxGuests) {
    return { valid: false, message: `El chalet admite de 1 a ${maxGuests} huéspedes.` };
  }

  return { valid: true, start, end, guestsCount: parsedGuests, visitTime: '' };
}

const isBookingOwner = (booking, user) => {
  if (!booking || !user?._id) return false;
  const guestId = booking.guest?._id || booking.guest;
  return Boolean(guestId && guestId.toString() === user._id.toString());
};

const isChaletOwner = (booking, user) => {
  if (!booking || !user?._id) return false;
  const hostId = booking.chalet?.host?._id || booking.chalet?.host;
  return Boolean(hostId && hostId.toString() === user._id.toString());
};

const canAccess = (booking, user) => Boolean(user && (user.role === 'admin' || isBookingOwner(booking, user) || isChaletOwner(booking, user)));

async function bookingWithRelations(id) {
  return Booking.findById(id)
    .populate('guest', 'name email avatar phone role verified')
    .populate({
      path: 'chalet',
      select: 'title thumbnail images pricePerNight priceUSD cleaningFee department municipality location status host',
      populate: { path: 'host', select: PUBLIC_USER_FIELDS },
    });
}

async function createAndEmitNotificationMessage({ senderId, recipientId, chaletId, content }) {
  try {
    const msg = await Message.create({
      sender: senderId,
      recipient: recipientId,
      chalet: chaletId || null,
      content: content.slice(0, 2000),
    });
    if (typeof msg.populate === 'function') {
      await msg.populate('sender recipient', PUBLIC_USER_FIELDS);
      await msg.populate('chalet', PUBLIC_CHALET_FIELDS);
    }
    const baseObj = msg.toObject ? msg.toObject() : msg;
    realtimeService.emitToUser(recipientId, 'message:new', {
      message: { ...baseObj, isMine: false },
    });
    realtimeService.emitToUser(senderId, 'message:new', {
      message: { ...baseObj, isMine: true },
    });
  } catch (err) {
    console.warn('No se pudo crear el mensaje automático de reserva:', err.message);
  }
}

// POST /api/bookings
exports.createBooking = async (req, res) => {
  try {
    const {
      chaletId,
      guestName,
      guestEmail,
      guestPhone,
      checkIn,
      checkOut,
      guestsCount,
      notes,
      status,
      bookingType = 'reserva',
      visitTime = '',
    } = req.body;

    if (!validId(chaletId)) {
      return res.status(400).json({ success: false, message: 'El identificador del chalet no es válido.' });
    }
    if (!VALID_BOOKING_TYPES.includes(bookingType)) {
      return res.status(400).json({ success: false, message: 'Tipo de solicitud no válido.' });
    }

    const chalet = await Chalet.findById(chaletId);
    if (!chalet) return res.status(404).json({ success: false, message: 'Chalet no encontrado.' });

    if (String(chalet.host) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'No puedes reservar ni pedir cita en tu propio chalet.' });
    }

    if (chalet.status === 'mantenimiento') {
      return res.status(400).json({ success: false, message: 'Este chalet se encuentra temporalmente en mantenimiento.' });
    }

    const validation = validateBookingInput({
      guestName,
      guestEmail,
      guestPhone,
      checkIn,
      checkOut,
      guestsCount,
      chalet,
      bookingType,
      visitTime,
    });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const { start, end } = validation;

    if (bookingType === 'reserva') {
      const conflictingBooking = await Booking.exists({
        chalet: chalet._id,
        bookingType: { $ne: 'cita' },
        status: { $in: ['confirmada', 'pendiente'] },
        checkIn: { $lt: end },
        checkOut: { $gt: start },
      });
      if (conflictingBooking) {
        return res.status(409).json({ success: false, message: 'El chalet ya tiene una reserva para esas fechas.' });
      }
    }

    if (!req.user.phone || req.user.phone === '+502 5555-0000') {
      req.user.phone = guestPhone.trim();
      if (typeof req.user.save === 'function') {
        await req.user.save();
      }
    }

    let nights = 0;
    let totalPriceGTQ = 0;
    if (bookingType === 'reserva') {
      const pricing = calculateBookingPricing(
        start,
        end,
        chalet.pricePerNight,
        chalet.cleaningFee ?? 150
      );
      nights = pricing.nights;
      totalPriceGTQ = pricing.totalPriceGTQ;
    }

    const initialStatus = bookingType === 'cita' || status === 'pendiente' ? 'pendiente' : 'confirmada';

    const booking = await Booking.create({
      guest: req.user._id,
      chalet: chalet._id,
      bookingType,
      visitTime: validation.visitTime,
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim().toLowerCase(),
      guestPhone: guestPhone.trim(),
      checkIn: start,
      checkOut: end,
      guestsCount: validation.guestsCount,
      nights,
      totalPriceGTQ,
      notes: notes?.trim() || '',
      status: initialStatus,
    });

    const populatedBooking = await bookingWithRelations(booking._id);

    // Emitir en tiempo real al propietario del chalet y al huésped
    if (chalet.host) {
      realtimeService.emitToUser(chalet.host, 'booking:created', { booking: populatedBooking });
    }
    realtimeService.emitToUser(req.user._id, 'booking:created', { booking: populatedBooking });

    // Crear mensaje automático en el chat con el anfitrión para coordinar la cita o estancia
    if (chalet.host && String(chalet.host) !== String(req.user._id)) {
      const checkInStr = toDateOnlyString(start);
      const checkOutStr = toDateOnlyString(end);
      const noteText = notes?.trim() ? `\nMensaje adicional: "${notes.trim()}"` : '';

      const autoMessageContent = bookingType === 'cita'
        ? `🗓️ ¡Hola! Quisiera pedir una CITA para visitar el chalet "${chalet.title}" el día ${checkInStr} a las ${validation.visitTime} (${validation.guestsCount} ${validation.guestsCount === 1 ? 'persona' : 'personas'}). Mi teléfono es ${guestPhone.trim()}.${noteText}`
        : `📅 ¡Hola! Acabo de enviar una solicitud de alquiler para "${chalet.title}" del ${checkInStr} al ${checkOutStr} (${nights} ${nights === 1 ? 'noche' : 'noches'}, ${validation.guestsCount} ${validation.guestsCount === 1 ? 'huésped' : 'huéspedes'}). Total estimado: Q${totalPriceGTQ.toLocaleString('es-GT')}. Mi teléfono es ${guestPhone.trim()}.${noteText}`;

      await createAndEmitNotificationMessage({
        senderId: req.user._id,
        recipientId: chalet.host,
        chaletId: chalet._id,
        content: autoMessageContent,
      });
    }

    const responseMessage = bookingType === 'cita'
      ? 'Solicitud de cita enviada al propietario correctamente.'
      : initialStatus === 'pendiente'
        ? 'Solicitud de alquiler enviada al propietario en tiempo real.'
        : 'Reserva confirmada correctamente.';

    return res.status(201).json({
      success: true,
      message: responseMessage,
      data: populatedBooking,
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    return res.status(400).json({ success: false, message: 'Error al procesar la solicitud.', error: error.message });
  }
};

// GET /api/bookings?status=confirmada&chaletId=<id>
// Guests see their bookings; hosts additionally see bookings for their chalets.
exports.getBookings = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) {
      if (!VALID_STATUSES.includes(req.query.status)) {
        return res.status(400).json({ success: false, message: 'Estado de reserva no válido.' });
      }
      filter.status = req.query.status;
    }
    if (req.query.chaletId) {
      if (!validId(req.query.chaletId)) {
        return res.status(400).json({ success: false, message: 'chaletId no es válido.' });
      }
      filter.chalet = req.query.chaletId;
    }

    if (req.user.role !== 'admin') {
      const hostedChalets = await Chalet.find({ host: req.user._id }).distinct('_id');
      filter.$or = [{ guest: req.user._id }, { chalet: { $in: hostedChalets } }];
    }

    const bookings = await Booking.find(filter)
      .populate('guest', 'name email avatar phone role verified')
      .populate({
        path: 'chalet',
        select: 'title thumbnail images pricePerNight priceUSD cleaningFee department municipality location status host',
        populate: { path: 'host', select: PUBLIC_USER_FIELDS },
      })
      .sort({ createdAt: -1, checkIn: 1 });
    return res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener reservas.', error: error.message });
  }
};

// GET /api/bookings/summary
exports.getBookingSummary = async (req, res) => {
  try {
    const hostedChalets = await Chalet.find({ host: req.user._id }).distinct('_id');
    const [pendingHostCount, totalGuestCount] = await Promise.all([
      hostedChalets.length
        ? Booking.countDocuments({ chalet: { $in: hostedChalets }, status: 'pendiente' })
        : 0,
      Booking.countDocuments({ guest: req.user._id }),
    ]);

    return res.json({
      success: true,
      data: { pendingHostCount, totalGuestCount },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No se pudo obtener el resumen de reservas.' });
  }
};

// GET /api/bookings/:id
exports.getBookingById = async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'El identificador no es válido.' });
    const booking = await bookingWithRelations(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Reserva no encontrada.' });
    if (!canAccess(booking, req.user)) return res.status(403).json({ success: false, message: 'No puedes consultar esta reserva.' });
    return res.json({ success: true, data: booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener la reserva.', error: error.message });
  }
};

// PATCH /api/bookings/:id/status { "status": "cancelada" }
exports.updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Estado de reserva no válido.' });
    }
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'El identificador no es válido.' });

    const booking = await bookingWithRelations(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Reserva no encontrada.' });
    const owner = isBookingOwner(booking, req.user);
    const host = isChaletOwner(booking, req.user) || req.user.role === 'admin';
    if (!owner && !host) return res.status(403).json({ success: false, message: 'No puedes modificar esta reserva.' });
    if (owner && !host && status !== 'cancelada') {
      return res.status(403).json({ success: false, message: 'El huésped solo puede cancelar su solicitud.' });
    }

    // Si se reactiva o confirma una reserva nocturna que estaba cancelada, verificar fechas libres
    if (
      booking.bookingType !== 'cita' &&
      (status === 'confirmada' || status === 'pendiente') &&
      booking.status === 'cancelada'
    ) {
      const chaletId = booking.chalet?._id || booking.chalet;
      if (chaletId) {
        const conflictingBooking = await Booking.exists({
          _id: { $ne: booking._id },
          chalet: chaletId,
          bookingType: { $ne: 'cita' },
          status: { $in: ['confirmada', 'pendiente'] },
          checkIn: { $lt: booking.checkOut },
          checkOut: { $gt: booking.checkIn },
        });
        if (conflictingBooking) {
          return res.status(409).json({
            success: false,
            message: 'No se puede activar esta reserva porque las fechas ya están ocupadas por otra reserva.',
          });
        }
      }
    }

    booking.status = status;
    await booking.save();

    const guestId = booking.guest?._id || booking.guest;
    const hostId = booking.chalet?.host?._id || booking.chalet?.host;
    if (guestId) realtimeService.emitToUser(guestId, 'booking:updated', { booking });
    if (hostId) realtimeService.emitToUser(hostId, 'booking:updated', { booking });

    // Notificar por chat a la contraparte sobre el cambio de estado
    const recipientId = String(req.user._id) === String(guestId) ? hostId : guestId;
    if (recipientId && String(recipientId) !== String(req.user._id)) {
      const chaletTitle = booking.chalet?.title || 'el chalet';
      const checkInStr = toDateOnlyString(booking.checkIn);
      const checkOutStr = toDateOnlyString(booking.checkOut);
      const statusLabel = status === 'confirmada' ? '✅ CONFIRMADA' : status === 'cancelada' ? '❌ CANCELADA' : '⏳ PENDIENTE';
      const kindLabel = booking.bookingType === 'cita'
        ? `la cita del ${checkInStr}${booking.visitTime ? ` (${booking.visitTime})` : ''}`
        : `la reserva (${checkInStr} al ${checkOutStr})`;
      const unlockedNote = booking.bookingType === 'cita' && status === 'confirmada'
        ? ' ¡El chat directo en TropicStay ya está habilitado para coordinar los detalles!'
        : '';

      await createAndEmitNotificationMessage({
        senderId: req.user._id,
        recipientId,
        chaletId: booking.chalet?._id || null,
        content: `🔔 El estado de ${kindLabel} para "${chaletTitle}" cambió a: ${statusLabel}.${unlockedNote}`,
      });
    }

    return res.json({ success: true, message: 'Estado actualizado.', data: booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No se pudo actualizar la reserva.', error: error.message });
  }
};

// Export pure helpers for unit testing
exports._helpers = {
  validId,
  parseBookingDate,
  toDateOnlyString,
  calculateBookingPricing,
  validateBookingInput,
  isBookingOwner,
  isChaletOwner,
  canAccess,
};
