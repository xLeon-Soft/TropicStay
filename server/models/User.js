const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'El correo electrónico es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  phone: {
    type: String,
    default: '+502 5555-0000',
  },
  avatar: {
    type: String,
    default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80',
  },
  role: {
    type: String,
    enum: ['host', 'guest', 'admin'],
    default: 'host',
  },
  verified: {
    type: Boolean,
    default: true,
  },
  superhost: {
    type: Boolean,
    default: true,
  },
  rating: {
    type: Number,
    default: 4.9,
    min: 1,
    max: 5,
  },
  reviewsCount: {
    type: Number,
    default: 28,
  },
  responseTime: {
    type: String,
    default: 'menos de 15 min',
  },
  memberSince: {
    type: String,
    default: '2023',
  },
  bio: {
    type: String,
    default: 'Apasionado por la hospitalidad y por compartir la belleza natural de Guatemala con viajeros de todo el mundo.',
  },
  location: {
    type: String,
    default: 'Guatemala',
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
