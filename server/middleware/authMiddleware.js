const jwt = require('jsonwebtoken');
const User = require('../models/User');

/** Validates the JWT issued after Google sign-in and loads its current user. */
const protect = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Se requiere iniciar sesión.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, message: 'La sesión ya no es válida.' });
    }
    req.user = user;
    return next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: 'La sesión expiró o el token no es válido.' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'No tienes permisos para esta operación.' });
  }
  return next();
};

module.exports = { protect, isAdmin };
