const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  chalet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chalet',
    required: true,
  },
  authorName: {
    type: String,
    required: [true, 'El nombre del autor es obligatorio'],
    trim: true,
  },
  authorAvatar: {
    type: String,
    default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&q=80',
  },
  rating: {
    type: Number,
    required: [true, 'La calificación es obligatoria'],
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    required: [true, 'El comentario es obligatorio'],
    trim: true,
  },
  cleanliness: {
    type: Number,
    min: 1,
    max: 5,
    default: 5,
  },
  location: {
    type: Number,
    min: 1,
    max: 5,
    default: 5,
  },
  communication: {
    type: Number,
    min: 1,
    max: 5,
    default: 5,
  },
  value: {
    type: Number,
    min: 1,
    max: 5,
    default: 5,
  },
  date: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true,
});

reviewSchema.index({ chalet: 1, date: -1 });

module.exports = mongoose.model('Review', reviewSchema);
