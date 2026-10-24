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
const currencyRoutes = require('./routes/currencyRoutes');
const messageRoutes = require('./routes/messageRoutes');
const { swaggerUi, swaggerSpec, swaggerUiOptions } = require('./config/swagger');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
const defaultOrigins = ['http://localhost:4200', 'http://127.0.0.1:4200', 'http://localhost:5000', 'http://127.0.0.1:5000'];
const allowedOrigins = [...new Set([...defaultOrigins, ...(process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean)])];
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
app.get('/api/docs', (_req, res) => res.redirect('/api-docs'));
app.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/chalets', chaletRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/hosts', hostRoutes);
app.use('/api/messages', messageRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', service: 'TropicStay API', timestamp: new Date() });
});

// Root welcome
app.get('/', (req, res) => {
  res.send('TropicStay API Server - Alquiler de Chalets en Guatemala. Documentación Swagger en: /api-docs');
});

// Return API errors as JSON instead of Express' default HTML response.
app.use((error, _req, res, _next) => {
  console.error('Error no controlado:', error.message);
  res.status(error.status || 500).json({ success: false, message: error.message || 'Error interno del servidor.' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`TropicStay API corriendo en http://localhost:${PORT}`);
  console.log(`Documentación Swagger interactiva: http://localhost:${PORT}/api-docs`);
});
