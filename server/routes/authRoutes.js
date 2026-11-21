const express = require('express');
const {
  googleLogin,
  register,
  login,
  getMe,
  updateProfile,
  getUserAvatar,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  issueStreamTicket,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

const emailOrIpKey = (prefix) => (req) => {
  const ip = req.ip || 'unknown';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return `${prefix}:${ip}:${email}`;
};

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: 'Demasiados intentos de inicio de sesión. Espera unos minutos antes de volver a intentarlo.',
  keyGenerator: emailOrIpKey('login'),
});

const registerLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: 'Demasiados registros desde esta conexión. Inténtalo nuevamente en unos minutos.',
});

const recoveryRequestLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Has solicitado varios códigos seguidos. Espera unos minutos antes de pedir otro.',
  keyGenerator: emailOrIpKey('forgot'),
});

const recoveryResetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos de verificación de código. Solicita un código nuevo más tarde.',
  keyGenerator: emailOrIpKey('reset'),
});

router.post('/google', loginLimiter, googleLogin);
router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.post('/forgot-password', recoveryRequestLimiter, forgotPassword);
router.post('/verify-reset-code', recoveryResetLimiter, verifyResetCode);
router.post('/reset-password', recoveryResetLimiter, resetPassword);
router.post('/stream-ticket', protect, issueStreamTicket);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/avatar/:userId', getUserAvatar);

module.exports = router;
