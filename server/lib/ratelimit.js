'use strict';
// Limitador em memória (por processo). Em produção multi-instância, trocar por Redis.
function createLimiter({ windowMs, max }) {
  const hits = new Map();
  return {
    take(key, now = Date.now()) {
      const e = hits.get(key);
      if (!e || e.reset <= now) { hits.set(key, { n: 1, reset: now + windowMs }); return true; }
      e.n++; return e.n <= max;
    },
    reset(key) { hits.delete(key); },
    sweep(now = Date.now()) { for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); },
  };
}
module.exports = { createLimiter };
