'use strict';
const { bad, forbidden, HttpError } = require('../lib/errors');
const { haversineM, validCoords, coarse } = require('../lib/geo');
const { dayKey, periodOf, DAY, HOUR, MIN } = require('../lib/time');
const { createLimiter } = require('../lib/ratelimit');

module.exports = (ctx, { profiles, plans }) => {
  const { db, config } = ctx;
  const P = config.paths;
  const listLimiter = createLimiter({ windowMs: HOUR, max: 30 }); // limita consultas (reduz inferência de rotina)

  const status = (userId) => {
    const s = profiles.getSettings(userId);
    return { consent: !!s.paths_consent_at, paused: !!s.pause_paths, consentVersion: s.paths_consent_version, revokedAt: s.paths_revoked_at };
  };
  function giveConsent(userId) {
    db.run('UPDATE settings SET paths_consent_at = ?, paths_consent_version = ?, paths_revoked_at = NULL WHERE user_id = ?', ctx.now(), P.consentVersion, userId);
    ctx.audit(userId, 'paths.consent', 'user', userId);
    return status(userId);
  }
  /** Revogar: interrompe a coleta e remove sinais e cruzamentos derivados. */
  function revoke(userId) {
    db.tx(() => {
      db.run('UPDATE settings SET paths_consent_at = NULL, paths_revoked_at = ? WHERE user_id = ?', ctx.now(), userId);
      db.run('DELETE FROM location_signals WHERE user_id = ?', userId);
      db.run('DELETE FROM crossings WHERE user_a = ? OR user_b = ?', userId, userId);
    });
    ctx.audit(userId, 'paths.revoke', 'user', userId);
    return status(userId);
  }
  function setPaused(userId, paused) {
    db.run('UPDATE settings SET pause_paths = ? WHERE user_id = ?', paused ? 1 : 0, userId);
    return status(userId);
  }

  function inSensitiveZone(lat, lng) {
    return db.all('SELECT * FROM sensitive_zones').some((z) => haversineM(lat, lng, z.lat, z.lng) <= z.radius_m);
  }

  /** Recebe um sinal de localização. Sem consentimento, em pausa ou impreciso: não guarda. */
  function submitSignal(userId, b) {
    const st = status(userId);
    if (!st.consent) throw forbidden('no_consent', 'Ative os Caminhos e dê seu consentimento antes de compartilhar sinais.');
    if (st.paused) throw forbidden('paused', 'Os Caminhos estão pausados.');
    const lat = Number(b.lat), lng = Number(b.lng), acc = Number(b.accuracyM);
    if (!validCoords(lat, lng) || !Number.isFinite(acc) || acc < 0) throw bad('invalid_signal', 'Sinal de localização inválido.');
    const now = ctx.now();
    const t = b.capturedAt ? Number(b.capturedAt) : now;
    if (!Number.isFinite(t) || t > now + MIN || t < now - 10 * MIN) return { accepted: false, reason: 'stale' };
    if (acc > P.maxAccuracyM) return { accepted: false, reason: 'imprecise' };
    if (inSensitiveZone(lat, lng)) return { accepted: false, reason: 'ignored' };
    if (db.get('SELECT COUNT(*) n FROM location_signals WHERE user_id = ? AND received_at > ?', userId, now - HOUR).n >= P.maxSignalsPerHour) return { accepted: false, reason: 'rate_limited' };
    db.run('INSERT INTO location_signals(user_id, lat, lng, accuracy_m, captured_at, received_at) VALUES (?,?,?,?,?,?)', userId, lat, lng, acc, t, now);
    return { accepted: true };
  }

  function eligible(a, b) {
    const [ua, ub] = [profiles.getUser(a), profiles.getUser(b)];
    if (!ua || !ub || ua.status !== 'active' || ub.status !== 'active') return false;
    const [sa, sb] = [profiles.getSettings(a), profiles.getSettings(b)];
    if (!sa.paths_consent_at || !sb.paths_consent_at || sa.pause_paths || sb.pause_paths) return false;
    if (plans.isDiscreet(a) || plans.isDiscreet(b)) return false; // modo discreto suprime exposição por caminhos
    if (profiles.isBlocked(a, b)) return false;
    return profiles.mutuallyCompatible(a, b);
  }

  /**
   * Processa cruzamentos: proximidade ≤ maxDistanceM, diferença ≤ maxTimeDiffMin,
   * ambos com precisão adequada, apresentação só após minDelayMin e com densidade mínima.
   */
  function process() {
    const now = ctx.now();
    const rows = db.all('SELECT * FROM location_signals WHERE captured_at > ? AND captured_at <= ? ORDER BY captured_at', now - P.rawRetentionH * HOUR, now - P.minDelayMin * MIN);
    const cells = new Map();
    const cellKey = (lat, lng) => `${Math.floor(lat * 100)}:${Math.floor(lng * 100)}`;
    for (const r of rows) { const k = cellKey(r.lat, r.lng); (cells.get(k) || cells.set(k, []).get(k)).push(r); }
    const best = new Map(); let created = 0;
    for (const r of rows) {
      const cx = Math.floor(r.lat * 100), cy = Math.floor(r.lng * 100);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const o of cells.get(`${cx + dx}:${cy + dy}`) || []) {
          if (o.user_id <= r.user_id) continue;
          if (Math.abs(o.captured_at - r.captured_at) > P.maxTimeDiffMin * MIN) continue;
          if (haversineM(r.lat, r.lng, o.lat, o.lng) > P.maxDistanceM) continue;
          const later = Math.max(o.captured_at, r.captured_at);
          const key = `${r.user_id}:${o.user_id}:${dayKey(later)}`;
          if (!best.has(key)) best.set(key, { a: r.user_id, b: o.user_id, t: later, lat: (r.lat + o.lat) / 2, lng: (r.lng + o.lng) / 2 });
        }
      }
    }
    for (const c of best.values()) {
      if (!eligible(c.a, c.b)) continue;
      // Baixa densidade: poucos usuários na região/janela tornariam a identificação trivial.
      const users = new Set();
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const o of cells.get(`${Math.floor(c.lat * 100) + dx}:${Math.floor(c.lng * 100) + dy}`) || []) if (Math.abs(o.captured_at - c.t) <= HOUR) users.add(o.user_id);
      if (users.size < P.minDensity) continue;
      const area = nearestArea(c.lat, c.lng);
      const r = db.run('INSERT OR IGNORE INTO crossings(user_a, user_b, day, period, area, created_at, expires_at) VALUES (?,?,?,?,?,?,?)', c.a, c.b, dayKey(c.t), periodOf(c.t), area, now, c.t + P.crossingRetentionD * DAY);
      if (r.changes) { created++; for (const id of [c.a, c.b]) ctx.notify(id, 'path', 'Caminhos cruzados', 'Você pode ter cruzado o caminho de alguém. Veja em Caminhos.', null); }
    }
    return { created };
  }
  function nearestArea(lat, lng) {
    let best = null, bd = 80000;
    for (const c of config.cities) { const d = haversineM(lat, lng, c.lat, c.lng); if (d < bd) { bd = d; best = c; } }
    return best ? `Região de ${best.name}` : 'Região aproximada';
  }

  /** Lista de cruzamentos: sem coordenadas, sem horário exato, sem distância. */
  function list(userId) {
    const st = status(userId);
    if (!st.consent) return { ...st, items: [] };
    if (st.paused) return { ...st, items: [] };
    if (!listLimiter.take(String(userId))) throw new HttpError(429, 'slow_down', 'Muitas consultas. Tente novamente mais tarde.');
    const rows = db.all('SELECT * FROM crossings WHERE (user_a = ?1 OR user_b = ?1) AND expires_at > ?2 ORDER BY created_at DESC', userId, ctx.now());
    const items = [];
    for (const c of rows) {
      const otherId = c.user_a === userId ? c.user_b : c.user_a;
      if (!eligible(userId, otherId)) continue;
      const card = profiles.publicCard(userId, profiles.getUser(otherId));
      card.distance = null;
      items.push({ id: c.id, day: c.day, period: c.period, area: c.area, user: card });
    }
    return { ...st, items };
  }

  function sweep() {
    const now = ctx.now();
    db.run('DELETE FROM location_signals WHERE captured_at < ?', now - P.rawRetentionH * HOUR);
    db.run('DELETE FROM crossings WHERE expires_at < ?', now);
  }
  return { status, giveConsent, revoke, setPaused, submitSignal, process, list, sweep };
};
