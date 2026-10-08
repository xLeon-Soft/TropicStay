const Booking = require('../models/Booking');
const Chalet = require('../models/Chalet');

// POST /api/bookings
exports.createBooking = async (req, res) => {
  try {
    const { chaletId, guestName, guestEmail, guestPhone, checkIn, checkOut, guestsCount, notes } = req.body;

    const chalet = await Chalet.findById(chaletId);
    if (!chalet) {
      return res.status(404).json({ success: false, message: 'Chalet no encontrado' });
    }

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

    const diffTime = end.getTime() - start.getTime();
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const totalPriceGTQ = (nights * chalet.pricePerNight) + (chalet.cleaningFee || 150);

    const booking = await Booking.create({
      chalet: chaletId,
      guestName,
      guestEmail,
      guestPhone,
      checkIn: start,
      checkOut: end,
      guestsCount: Number(guestsCount) || 2,
      nights,
      totalPriceGTQ,
      notes,
      status: 'confirmada',
    });

    res.status(201).json({
      success: true,
      message: '¡Reserva confirmada con éxito!',
      data: booking,
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(400).json({ success: false, message: 'Error al procesar reserva', error: error.message });
  }
};

// GET /api/bookings
exports.getBookings = async (req, res) => {
  try {
    const bookings = await Booking.find().populate('chalet').sort({ createdAt: -1 });
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener reservas' });
  }
};
