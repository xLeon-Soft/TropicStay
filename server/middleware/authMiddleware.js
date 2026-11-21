const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const STREAM_TICKET_TTL_MS = 60 * 1000;
const streamTickets = new Map();

function createStreamTicket(userId) {
  const ticket = crypto.randomBytes(24).toString('hex');
  streamTickets.set(ticket, {
    userId: String(userId),
    expiresAt: Date.now() + STREAM_TICKET_TTL_MS,
  });

  if (streamTickets.size > 500) {
    const now = Date.now();
    for (const [key, entry] of streamTickets.entries()) {
      if (entry.expiresAt <= now) streamTickets.delete(key);
    }
  }
  return ticket;
}

function consumeStreamTicket(ticket) {
  if (!ticket) return null;
  const entry = streamTickets.get(ticket);
  if (!entry) return null;
  streamTickets.delete(ticket);
  if (entry.expiresAt <= Date.now()) return null;
  return entry.userId;
}

async function resolveUserFromToken(token) {
  if (!token || !process.env.JWT_SECRET) return null;
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  return User.findById(payload.sub);
}

/** Validates the JWT issued after sign-in and loads its current user. */
const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Se requiere iniciar sesión.' });
  }

  try {
    const user = await resolveUserFromToken(token);
    if (!user) {
      return res.status(401).json({ success: false, message: 'La sesión ya no es válida.' });
    }
    req.user = user;
    return next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: 'La sesión expiró o el token no es válido.' });
  }
};

/** Validates JWT from Authorization header, one-time SSE ticket, or legacy query token. */
const protectStream = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const queryTicket = typeof req.query.ticket === 'string' ? req.query.ticket : null;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;

  try {
    if (queryTicket) {
      const ticketUserId = consumeStreamTicket(queryTicket);
      if (!ticketUserId) {
        return res.status(401).json({ success: false, message: 'Ticket de tiempo real inválido o expirado.' });
      }
      const user = await User.findById(ticketUserId);
      if (!user) {
        return res.status(401).json({ success: false, message: 'La sesión ya no es válida.' });
      }
      req.user = user;
      return next();
    }

    const token = bearerToken || queryToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Se requiere iniciar sesión para eventos en tiempo real.' });
    }

    const user = await resolveUserFromToken(token);
    if (!user) {
      return res.status(401).json({ success: false, message: 'La sesión ya no es válida.' });
    }
    req.user = user;
    return next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: 'Token expirado o inválido.' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'No tienes permisos para esta operación.' });
  }
  return next();
};

module.exports = { protect, protectStream, isAdmin, createStreamTicket };
