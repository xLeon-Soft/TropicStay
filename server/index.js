require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const chaletRoutes = require('./routes/chaletRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const hostRoutes = require('./routes/hostRoutes');
const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/chalets', chaletRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/hosts', hostRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'TropicStay API', timestamp: new Date() });
});

// Root welcome
app.get('/', (req, res) => {
  res.send('TropicStay API Server - Alquiler de Chalets en Guatemala');
});

// Start Server
app.listen(PORT, () => {
  console.log(`TropicStay API corriendo en http://localhost:${PORT}`);
});
