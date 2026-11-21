const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const authController = require('../controllers/authController');
const User = require('../models/User');
const emailService = require('../services/emailService');
const { createRateLimiter } = require('../middleware/rateLimitMiddleware');
const { protectStream, createStreamTicket } = require('../middleware/authMiddleware');

function createMockRes() {
  const headers = {};
  return {
    statusCode: 200,
    body: null,
    headers,
    setHeader(name, value) {
      headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('Módulo de Autenticación - Recuperación de Cuenta, OTP y Seguridad', () => {
  const originalFindOne = User.findOne;
  const originalFindById = User.findById;
  const originalSendReset = emailService.sendPasswordResetCode;

  afterEach(() => {
    User.findOne = originalFindOne;
    User.findById = originalFindById;
    emailService.sendPasswordResetCode = originalSendReset;
  });

  it('forgotPassword() genera un código OTP de 6 dígitos hasheado, guarda expiración y envía correo', async () => {
    const userId = new mongoose.Types.ObjectId();
    let savedCodeHash = '';
    let sentCode = '';

    const fakeUser = {
      _id: userId,
      name: 'Alexander De León',
      email: 'alex@tropicstay.gt',
      save: async () => {
        savedCodeHash = fakeUser.resetPasswordCodeHash;
      },
    };

    User.findOne = () => ({
      select: async () => fakeUser,
    });
    emailService.sendPasswordResetCode = async ({ to, code }) => {
      assert.equal(to, 'alex@tropicstay.gt');
      sentCode = code;
      return { delivered: true, mode: 'smtp' };
    };

    const req = { body: { email: 'Alex@TropicStay.gt' } };
    const res = createMockRes();
    await authController.forgotPassword(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.match(sentCode, /^\d{6}$/);
    assert.ok(savedCodeHash);
    assert.notEqual(savedCodeHash, sentCode);
    assert.ok(fakeUser.resetPasswordExpiresAt instanceof Date);
    assert.equal(res.body.devPreviewCode, undefined);
  });

  it('resetPassword() valida código, actualiza passwordHash y limpia el OTP en MongoDB', async () => {
    const userId = new mongoose.Types.ObjectId();
    const code = '482913';
    const fakeUser = {
      _id: userId,
      email: 'alex@tropicstay.gt',
      passwordHash: authController._helpers.hashPassword('Antigua123!'),
      resetPasswordCodeHash: authController._helpers.hashResetCode(userId, code),
      resetPasswordExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      resetPasswordAttempts: 0,
      verified: false,
      save: async () => {},
    };

    User.findOne = () => ({
      select: async () => fakeUser,
    });

    const req = {
      body: {
        email: 'alex@tropicstay.gt',
        code,
        newPassword: 'NuevaClaveSegura#2026',
      },
    };
    const res = createMockRes();
    await authController.resetPassword(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(fakeUser.verified, true);
    assert.equal(fakeUser.resetPasswordCodeHash, undefined);
    assert.equal(fakeUser.resetPasswordExpiresAt, undefined);
    assert.equal(authController._helpers.verifyPassword('NuevaClaveSegura#2026', fakeUser.passwordHash), true);
    assert.equal(authController._helpers.verifyPassword('Antigua123!', fakeUser.passwordHash), false);
  });

  it('resetPassword() bloquea e invalida el código tras 5 intentos fallidos', async () => {
    const userId = new mongoose.Types.ObjectId();
    const fakeUser = {
      _id: userId,
      email: 'alex@tropicstay.gt',
      resetPasswordCodeHash: authController._helpers.hashResetCode(userId, '123456'),
      resetPasswordExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      resetPasswordAttempts: 4,
      save: async () => {},
    };

    User.findOne = () => ({
      select: async () => fakeUser,
    });

    const req = {
      body: {
        email: 'alex@tropicstay.gt',
        code: '999999',
        newPassword: 'OtraClave#2026',
      },
    };
    const res = createMockRes();
    await authController.resetPassword(req, res);

    assert.equal(res.statusCode, 429);
    assert.equal(fakeUser.resetPasswordCodeHash, undefined);
    assert.equal(fakeUser.resetPasswordAttempts, 0);
  });

  it('createRateLimiter() responde 429 al superar el máximo de intentos', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, message: 'Bloqueado temporalmente' });
    let nextCount = 0;

    const req = { ip: '127.0.0.1', headers: {} };
    const r1 = createMockRes();
    limiter(req, r1, () => { nextCount += 1; });
    const r2 = createMockRes();
    limiter(req, r2, () => { nextCount += 1; });
    const r3 = createMockRes();
    limiter(req, r3, () => { nextCount += 1; });

    assert.equal(nextCount, 2);
    assert.equal(r3.statusCode, 429);
    assert.equal(r3.body.message, 'Bloqueado temporalmente');
  });

  it('protectStream() acepta ticket de un solo uso y rechaza reutilizarlo', async () => {
    const userId = new mongoose.Types.ObjectId();
    const ticket = createStreamTicket(userId);
    User.findById = async () => ({ _id: userId, email: 'alex@tropicstay.gt' });

    const req1 = { headers: {}, query: { ticket } };
    const res1 = createMockRes();
    let passed1 = false;
    await protectStream(req1, res1, () => { passed1 = true; });
    assert.equal(passed1, true);

    const req2 = { headers: {}, query: { ticket } };
    const res2 = createMockRes();
    let passed2 = false;
    await protectStream(req2, res2, () => { passed2 = true; });
    assert.equal(passed2, false);
    assert.equal(res2.statusCode, 401);
  });

  it('verifyResetCode() bloquea código vencido, pero tras verificar a tiempo no vuelve a expirar al cambiar contraseña', async () => {
    const userId = new mongoose.Types.ObjectId();
    const code = '774411';

    // 1. Código expirado antes de verificar -> debe rechazarlo (400)
    const expiredUser = {
      _id: userId,
      email: 'alex@tropicstay.gt',
      resetPasswordCodeHash: authController._helpers.hashResetCode(userId, code),
      resetPasswordExpiresAt: new Date(Date.now() - 5000),
      resetPasswordAttempts: 0,
      resetPasswordVerified: false,
      save: async () => {},
    };
    User.findOne = () => ({ select: async () => expiredUser });

    const expiredRes = createMockRes();
    await authController.verifyResetCode({ body: { email: 'alex@tropicstay.gt', code } }, expiredRes);
    assert.equal(expiredRes.statusCode, 400);
    assert.match(expiredRes.body.message, /expiró/i);

    // 2. Código verificado a tiempo -> aunque pase el tiempo en el paso 3, resetPassword() lo acepta
    const verifiedUser = {
      _id: userId,
      email: 'alex@tropicstay.gt',
      passwordHash: authController._helpers.hashPassword('ClaveAntes#1'),
      resetPasswordCodeHash: authController._helpers.hashResetCode(userId, code),
      resetPasswordExpiresAt: new Date(Date.now() + 60_000),
      resetPasswordAttempts: 0,
      resetPasswordVerified: false,
      verified: false,
      save: async () => {},
    };
    User.findOne = () => ({ select: async () => verifiedUser });

    const verifyRes = createMockRes();
    await authController.verifyResetCode({ body: { email: 'alex@tropicstay.gt', code } }, verifyRes);
    assert.equal(verifyRes.statusCode, 200);
    assert.equal(verifiedUser.resetPasswordVerified, true);

    // Simular que el tiempo transcurrió mientras estaba en el Paso 3
    verifiedUser.resetPasswordExpiresAt = new Date(Date.now() - 120_000);

    const resetRes = createMockRes();
    await authController.resetPassword(
      { body: { email: 'alex@tropicstay.gt', code, newPassword: 'Admin123*' } },
      resetRes
    );
    assert.equal(resetRes.statusCode, 200);
    assert.equal(verifiedUser.resetPasswordVerified, false);
    assert.equal(authController._helpers.verifyPassword('Admin123*', verifiedUser.passwordHash), true);
  });
});
