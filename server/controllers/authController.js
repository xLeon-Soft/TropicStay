const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const googleClient = new OAuth2Client();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_CACHE_TTL_MS = 30 * 60 * 1000;
const avatarCache = new Map();

function getUserInitials(name) {
  const parts = String(name || 'TS')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'TS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function buildInitialsSvg(name) {
  const initials = getUserInitials(name).replace(/[^A-Z0-9]/gi, '') || 'TS';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${initials}">
  <defs>
    <linearGradient id="tsBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d5244"/>
      <stop offset="100%" stop-color="#19826c"/>
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="48" fill="url(#tsBg)"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="system-ui,-apple-system,sans-serif" font-size="34" font-weight="700">${initials}</text>
</svg>`;
}

const serializeUser = (user) => ({
  _id: user._id.toString(),
  name: user.name,
  email: user.email,
  picture: user.avatar,
  role: user.role,
  phone: user.phone,
  bio: user.bio,
  responseTime: user.responseTime,
  verified: user.verified,
  superhost: user.superhost,
});

function signToken(user) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET no configurado en el servidor.');
  }
  return jwt.sign(
    { sub: user._id.toString(), email: user.email },
    jwtSecret,
    { expiresIn: '24h' }
  );
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  const expectedKey = Buffer.from(keyHex, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  if (expectedKey.length !== derivedKey.length) return false;
  return crypto.timingSafeEqual(expectedKey, derivedKey);
}

const register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPassword = typeof password === 'string' ? password : '';
    const cleanPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : '+502 5555-0000';

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ success: false, message: 'Ingresa tu nombre completo.' });
    }
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'El correo electrónico no es válido.' });
    }
    if (cleanPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const existing = await User.findOne({ email: cleanEmail }).select('_id passwordHash');
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe una cuenta registrada con este correo. Inicia sesión.',
      });
    }

    const allowedRole = role === 'host' ? 'host' : 'guest';
    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      passwordHash: hashPassword(cleanPassword),
      phone: cleanPhone,
      role: allowedRole,
      verified: true,
      superhost: false,
      reviewsCount: 0,
    });

    const token = signToken(user);
    return res.status(201).json({
      success: true,
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error('Error registrando usuario:', error.message);
    return res.status(500).json({ success: false, message: 'No se pudo completar el registro.' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPassword = typeof password === 'string' ? password : '';

    if (!EMAIL_REGEX.test(cleanEmail) || !cleanPassword) {
      return res.status(400).json({ success: false, message: 'Ingresa tu correo y contraseña.' });
    }

    const user = await User.findOne({ email: cleanEmail }).select('+passwordHash');
    if (!user || !user.passwordHash || !verifyPassword(cleanPassword, user.passwordHash)) {
      return res.status(401).json({
        success: false,
        message: 'Correo o contraseña incorrectos. Si creaste tu cuenta con Google, usa "Continuar con Google".',
      });
    }

    const token = signToken(user);
    return res.json({
      success: true,
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error('Error iniciando sesión:', error.message);
    return res.status(500).json({ success: false, message: 'Error al iniciar sesión.' });
  }
};

const googleLogin = async (req, res) => {
  const { credential } = req.body;
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const jwtSecret = process.env.JWT_SECRET;

  if (!googleClientId || !jwtSecret) {
    return res.status(500).json({
      success: false,
      message: 'El inicio de sesión no está configurado en el servidor.',
    });
  }

  if (!credential) {
    return res.status(400).json({ success: false, message: 'Credencial de Google requerida.' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      return res.status(401).json({ success: false, message: 'La cuenta de Google no pudo verificarse.' });
    }

    const user = await User.findOneAndUpdate(
      { email: payload.email.toLowerCase() },
      {
        $set: {
          name: payload.name || payload.email,
          avatar: payload.picture || undefined,
          googleId: payload.sub,
          verified: true,
        },
        $setOnInsert: { role: 'guest', superhost: false, reviewsCount: 0 },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const token = signToken(user);

    return res.json({
      success: true,
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error('Error verificando el acceso con Google:', error.message);
    return res.status(401).json({ success: false, message: 'La credencial de Google no es válida.' });
  }
};

const getMe = async (req, res) => {
  return res.json({
    success: true,
    user: serializeUser(req.user),
  });
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone, bio, responseTime, avatar, role } = req.body;
    if (typeof name === 'string' && name.trim()) req.user.name = name.trim();
    if (typeof phone === 'string' && phone.trim()) req.user.phone = phone.trim();
    if (typeof bio === 'string' && bio.trim()) req.user.bio = bio.trim();
    if (typeof responseTime === 'string' && responseTime.trim()) req.user.responseTime = responseTime.trim();
    if (typeof avatar === 'string' && avatar.trim()) req.user.avatar = avatar.trim();
    if ((role === 'guest' || role === 'host') && req.user.role !== 'admin') {
      req.user.role = role;
    }

    await req.user.save();
    return res.json({
      success: true,
      message: 'Perfil actualizado correctamente.',
      user: serializeUser(req.user),
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'No se pudo actualizar el perfil.',
      error: error.message,
    });
  }
};

const getUserAvatar = async (req, res) => {
  const sendSvgFallback = (name) => {
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.status(200).send(buildInitialsSvg(name));
  };

  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return sendSvgFallback('TS');
    }

    const user = await User.findById(userId).select('avatar name').lean();
    if (!user) {
      return sendSvgFallback('TS');
    }

    const avatarUrl = typeof user.avatar === 'string' ? user.avatar.trim() : '';
    if (!avatarUrl || !/^https?:\/\//i.test(avatarUrl)) {
      return sendSvgFallback(user.name);
    }

    const cacheKey = `${userId}:${avatarUrl}`;
    const cached = avatarCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      return res.status(200).send(cached.buffer);
    }

    const upstream = await fetch(avatarUrl, {
      headers: { Accept: 'image/*' },
      signal: AbortSignal.timeout(5000),
    });

    const contentType = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !contentType.startsWith('image/')) {
      return sendSvgFallback(user.name);
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (!buffer.length) {
      return sendSvgFallback(user.name);
    }

    if (avatarCache.size >= 200) {
      const oldestKey = avatarCache.keys().next().value;
      if (oldestKey) avatarCache.delete(oldestKey);
    }
    avatarCache.set(cacheKey, {
      buffer,
      contentType,
      expiresAt: Date.now() + AVATAR_CACHE_TTL_MS,
    });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.status(200).send(buffer);
  } catch {
    return sendSvgFallback('TS');
  }
};

module.exports = { googleLogin, register, login, getMe, updateProfile, getUserAvatar };
