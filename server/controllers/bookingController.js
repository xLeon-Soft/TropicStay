const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Chalet = require('../models/Chalet');

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

const isBookingOwner = (booking, user) => {
  const guestId = booking.guest?._id || booking.guest;
  return Boolean(guestId && guestId.toString() === user._id.toString());
};
const isChaletOwner = (booking, user) => booking.chalet?.host?._id?.toString() === user._id.toString();
const canAccess = (booking, user) => user.role === 'admin' || isBookingOwner(booking, user) || isChaletOwner(booking, user);

async function bookingWithRelations(id) {
  return Booking.findById(id)
    .populate('guest', 'name email avatar phone')
    .populate({ path: 'chalet', populate: { path: 'host', select: 'name email' } });
}

// POST /api/bookings
exports.createBooking = async (req, res) => {
  try {
    const { chaletId, guestName, guestEmail, guestPhone, checkIn, checkOut, guestsCount, notes } = req.body;
    if (!validId(chaletId)) {
      return res.status(400).json({ success: false, message: 'El identificador del chalet no es válido.' });
    }

    const chalet = await Chalet.findById(chaletId);
    if (!chalet) return res.status(404).json({ success: false, message: 'Chalet no encontrado.' });

    const start = new Date(`${checkIn}T00:00:00`);
    const end = new Date(`${checkOut}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!guestName?.trim() || !guestEmail?.trim() || !guestPhone?.trim()) {
      return res.status(400).json({ success: false, message: 'Nombre, correo y teléfono son obligatorios.' });
    }
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start < today || end <= start) {
      return res.status(400).json({ success: false, message: 'Las fechas de reserva no son válidas.' });
    }
    if (!Number.isInteger(Number(guestsCount)) || Number(guestsCount) < 1 || Number(guestsCount) > chalet.guestsMax) {
      return res.status(400).json({ success: false, message: `El chalet admite de 1 a ${chalet.guestsMax} huéspedes.` });
    }

    const conflictingBooking = await Booking.exists({
      chalet: chalet._id,
      status: { $in: ['confirmada', 'pendiente'] },
      checkIn: { $lt: end },
      checkOut: { $gt: start },
    });
    if (conflictingBooking) {
      return res.status(409).json({ success: false, message: 'El chalet ya tiene una reserva para esas fechas.' });
    }

    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const booking = await Booking.create({
      guest: req.user._id,
      chalet: chalet._id,
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim().toLowerCase(),
      guestPhone: guestPhone.trim(),
      checkIn: start,
      checkOut: end,
      guestsCount: Number(guestsCount),
      nights,
      totalPriceGTQ: (nights * chalet.pricePerNight) + (chalet.cleaningFee || 0),
      notes: notes?.trim() || '',
      status: 'confirmada',
    });

    return res.status(201).json({
      success: true,
      message: 'Reserva confirmada correctamente.',
      data: await bookingWithRelations(booking._id),
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    return res.status(400).json({ success: false, message: 'Error al procesar reserva.', error: error.message });
  }
};

// GET /api/bookings?status=confirmada&chaletId=<id>
// Guests see their bookings; hosts additionally see bookings for their chalets.
exports.getBookings = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
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
      .populate('guest', 'name email avatar phone')
      .populate({ path: 'chalet', populate: { path: 'host', select: 'name email' } })
      .sort({ checkIn: 1 });
    return res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error al obtener reservas.', error: error.message });
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
    if (!['confirmada', 'pendiente', 'cancelada'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Estado de reserva no válido.' });
    }
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'El identificador no es válido.' });

    const booking = await bookingWithRelations(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Reserva no encontrada.' });
    const owner = isBookingOwner(booking, req.user);
    const host = isChaletOwner(booking, req.user) || req.user.role === 'admin';
    if (!owner && !host) return res.status(403).json({ success: false, message: 'No puedes modificar esta reserva.' });
    if (owner && !host && status !== 'cancelada') {
      return res.status(403).json({ success: false, message: 'El huésped solo puede cancelar su reserva.' });
    }

    booking.status = status;
    await booking.save();
    return res.json({ success: true, message: 'Estado de reserva actualizado.', data: booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No se pudo actualizar la reserva.', error: error.message });
  }
};
