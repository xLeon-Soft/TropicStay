const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  guest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  chalet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chalet',
    required: true,
  },
  bookingType: {
    type: String,
    enum: ['reserva', 'cita'],
    default: 'reserva',
  },
  visitTime: {
    type: String,
    default: '',
    trim: true,
  },
  guestName: {
    type: String,
    required: [true, 'El nombre del huésped es obligatorio'],
    trim: true,
  },
  guestEmail: {
    type: String,
    required: [true, 'El correo del huésped es obligatorio'],
    trim: true,
  },
  guestPhone: {
    type: String,
    required: [true, 'El número de teléfono es obligatorio'],
    trim: true,
  },
  checkIn: {
    type: Date,
    required: [true, 'La fecha de llegada es obligatoria'],
  },
  checkOut: {
    type: Date,
    required: [true, 'La fecha de salida es obligatoria'],
  },
  guestsCount: {
    type: Number,
    required: true,
    min: 1,
    default: 2,
  },
  nights: {
    type: Number,
    required: true,
    min: 0,
  },
  totalPriceGTQ: {
    type: Number,
    required: true,
    min: 0,
  },
  notes: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['confirmada', 'pendiente', 'cancelada'],
    default: 'confirmada',
  }
}, {
  timestamps: true,
});

bookingSchema.index({ chalet: 1, status: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ guest: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
