const mongoose = require('mongoose');

const chaletSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'El título del chalet es obligatorio'],
    trim: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['Lago', 'Playa', 'Montaña', 'Colonial', 'Selva', 'Río'],
    default: 'Lago',
  },
  department: {
    type: String,
    required: [true, 'El departamento de Guatemala es obligatorio'],
    trim: true,
  },
  municipality: {
    type: String,
    required: [true, 'El municipio es obligatorio'],
    trim: true,
  },
  locationName: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'La descripción es obligatoria'],
  },
  pricePerNight: {
    type: Number,
    required: [true, 'El precio por noche es obligatorio'],
    min: 0,
  },
  priceUSD: {
    type: Number,
    min: 0,
  },
  deposit: {
    type: Number,
    default: 500,
  },
  cleaningFee: {
    type: Number,
    default: 150,
  },
  guestsMax: {
    type: Number,
    required: true,
    min: 1,
    default: 4,
  },
  bedrooms: {
    type: Number,
    required: true,
    min: 1,
    default: 2,
  },
  beds: {
    type: Number,
    required: true,
    min: 1,
    default: 2,
  },
  bathrooms: {
    type: Number,
    required: true,
    min: 1,
    default: 2,
  },
  images: [{
    type: String,
    required: true,
  }],
  thumbnail: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    default: 4.9,
    min: 1,
    max: 5,
  },
  reviewsCount: {
    type: Number,
    default: 0,
  },
  ratingBreakdown: {
    cleanliness: { type: Number, default: 4.9 },
    accuracy: { type: Number, default: 4.8 },
    communication: { type: Number, default: 5.0 },
    location: { type: Number, default: 4.9 },
    value: { type: Number, default: 4.8 },
  },
  amenities: [{
    type: String,
  }],
  rules: [{
    type: String,
  }],
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  featured: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['disponible', 'reservado', 'mantenimiento'],
    default: 'disponible',
  },
  coordinates: {
    lat: { type: Number, default: 14.7356 },
    lng: { type: Number, default: -91.2025 },
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Chalet', chaletSchema);
