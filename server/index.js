require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const chaletRoutes = require('./routes/chaletRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const hostRoutes = require('./routes/hostRoutes');
const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const currencyRoutes = require('./routes/currencyRoutes');
const messageRoutes = require('./routes/messageRoutes');
const eventRoutes = require('./routes/eventRoutes');
const realtimeService = require('./services/realtimeService');
const { swaggerUi, swaggerSpec, swaggerUiOptions } = require('./config/swagger');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Connect to MongoDB
connectDB();

// Security headers (allow Google OAuth popup flow cleanly in production)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// Middleware
const defaultOrigins = ['http://localhost:4200', 'http://127.0.0.1:4200', `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];
const allowedOrigins = [...new Set([...defaultOrigins, ...(process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean)])];
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '1mb' }));
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
app.use('/api/events', eventRoutes);

// Health & Readiness check
app.get('/api/health', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    success: dbReady,
    status: dbReady ? 'ok' : 'degraded',
    database: dbReady ? 'connected' : 'disconnected',
    realtimeClients: realtimeService.getConnectedUserCount(),
    service: 'TropicStay API',
    timestamp: new Date(),
  });
});

// Serve Angular production bundle when present (single-server production deployment)
const clientDistDir = path.join(__dirname, '..', 'client', 'dist', 'client', 'browser');
const clientIndexHtml = path.join(clientDistDir, 'index.html');
if (process.env.SERVE_CLIENT !== 'false' && fs.existsSync(clientIndexHtml)) {
  app.use(express.static(clientDistDir, { maxAge: '1h' }));
  app.get(/^(?!\/api(?:\/|$)|\/uploads(?:\/|$)|\/api-docs(?:\/|$)).*/, (_req, res) => {
    res.sendFile(clientIndexHtml);
  });
} else {
  app.get('/', (_req, res) => {
    res.send('TropicStay API Server - Alquiler de Chalets en Guatemala. Documentación Swagger en: /api-docs');
  });
}

// Return API errors as JSON instead of Express' default HTML response.
app.use((error, _req, res, _next) => {
  console.error('Error no controlado:', error.message);
  res.status(error.status || 500).json({ success: false, message: error.message || 'Error interno del servidor.' });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`TropicStay API corriendo en http://localhost:${PORT}`);
  console.log(`Documentación Swagger interactiva: http://localhost:${PORT}/api-docs`);
});

function shutdown(signal) {
  console.log(`\nRecibido ${signal}, cerrando TropicStay API de forma segura...`);
  server.close(async () => {
    await mongoose.connection.close().catch(() => undefined);
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
