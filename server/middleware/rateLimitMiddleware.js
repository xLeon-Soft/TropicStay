/**
 * In-memory sliding/fixed-window rate limiter to protect auth endpoints
 * from brute-force and credential-stuffing attacks without extra dependencies.
 */
function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 10,
  message = 'Demasiados intentos. Por favor espera unos minutos antes de volver a intentarlo.',
  keyGenerator,
} = {}) {
  const hits = new Map();

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (entry.resetAt <= now) {
        hits.delete(key);
      }
    }
  }, Math.max(windowMs, 60 * 1000));
  if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const key = keyGenerator
      ? keyGenerator(req)
      : `${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`;

    const existing = hits.get(key);
    if (!existing || existing.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - 1)));
      return next();
    }

    existing.count += 1;
    const remaining = Math.max(0, max - existing.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (existing.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message,
        retryAfterSeconds,
      });
    }

    return next();
  };
}

module.exports = { createRateLimiter };
