const express = require('express');
const { protectStream } = require('../middleware/authMiddleware');
const realtimeService = require('../services/realtimeService');

const router = express.Router();

function initSseStream(req, res, { userId = null, onRegister, onCleanup }) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  onRegister();

  // Confirm connection immediately
  res.write(`event: connected\ndata: ${JSON.stringify({ userId, timestamp: new Date().toISOString() })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch (_err) {
      clearInterval(heartbeat);
      onCleanup();
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    onCleanup();
  });
}

// GET /api/events/stream?token=<jwt> (authenticated users: private + catalog events)
router.get('/stream', protectStream, (req, res) => {
  const userId = req.user._id.toString();
  initSseStream(req, res, {
    userId,
    onRegister: () => realtimeService.addClient(userId, res),
    onCleanup: () => realtimeService.removeClient(userId, res),
  });
});

// GET /api/events/public-stream (public visitors: chalet status & catalog events)
router.get('/public-stream', (req, res) => {
  initSseStream(req, res, {
    userId: null,
    onRegister: () => realtimeService.addPublicClient(res),
    onCleanup: () => realtimeService.removePublicClient(res),
  });
});

module.exports = router;

