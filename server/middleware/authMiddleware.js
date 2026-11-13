const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

/** Validates JWT from Authorization header or query param (for SSE EventSource). */
const protectStream = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  const token = bearerToken || queryToken;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Se requiere iniciar sesión para eventos en tiempo real.' });
  }

  try {
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

module.exports = { protect, protectStream, isAdmin };
