'use strict';
const { bad, forbidden, notFound, conflict, HttpError } = require('../lib/errors');
const { dayKey, nextMidnight, ageFrom, DAY } = require('../lib/time');

module.exports = (ctx, { profiles, plans }) => {
  const { db, config } = ctx;

  function viewerOrThrow(userId) {
    const u = profiles.getUser(userId);
    if (!u || u.status !== 'active') throw forbidden('account_unavailable', 'Sua conta não está disponível para essa ação.');
    return u;
  }
  function quota(userId) {
    const day = dayKey(ctx.now());
    const row = db.get('SELECT used FROM daily_likes WHERE user_id = ? AND day = ?', userId, day);
    const plan = plans.planOf(userId);
    const limit = plans.limitFor(plan);
    const used = row ? row.used : 0;
    return { limit, used, remaining: Math.max(0, limit - used), renewsAt: nextMidnight(ctx.now()), timezone: config.timezone };
  }
  function hashRank(a, b, day) { let h = 2166136261; for (const c of `${a}|${b}|${day}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

  /** Descoberta: todas as regras são aplicadas aqui, nunca só no cliente. */
  function discover(userId, { limit = 10 } = {}) {
    const me = viewerOrThrow(userId);
    const my = profiles.getSettings(userId);
    if (my.pause_discovery) return { paused: true, items: [] };
    if (!profiles.isComplete(userId)) return { incomplete: true, items: [] };
    const now = ctx.now();
    const resurface = config.resurfacePassedDays > 0 ? now - config.resurfacePassedDays * DAY : Infinity;
    const rows = db.all(`
      SELECT u.* FROM users u
      JOIN profiles p ON p.user_id = u.id
      JOIN settings s ON s.user_id = u.id
      WHERE u.id != ? AND u.status = 'active' AND s.pause_discovery = 0
        AND p.display_name != '' AND p.intent IS NOT NULL
        AND EXISTS (SELECT 1 FROM photos ph WHERE ph.user_id = u.id AND ph.status = 'approved')
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?1))
        AND NOT EXISTS (SELECT 1 FROM likes l WHERE l.from_id = ?1 AND l.to_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.user_a = MIN(?1, u.id) AND m.user_b = MAX(?1, u.id))
        AND NOT EXISTS (SELECT 1 FROM passes ps WHERE ps.from_id = ?1 AND ps.to_id = u.id AND ps.created_at > ?2)
      LIMIT 400`, userId, resurface === Infinity ? 0 : resurface);
    const day = dayKey(now);
    const out = [];
    for (const u of rows) {
      if (!profiles.mutuallyCompatible(userId, u.id)) continue;
      // Modo discreto (Premium): só aparece para quem ele(a) já curtiu.
      if (plans.isDiscreet(u.id) && !db.get('SELECT 1 FROM likes WHERE from_id = ? AND to_id = ? AND active = 1', u.id, userId)) continue;
      const boosted = plans.activeBoost(u.id) ? 0 : 1;
      out.push({ u, rank: boosted * 4294967296 + hashRank(userId, u.id, day) });
    }
    out.sort((a, b) => a.rank - b.rank);
    return { items: out.slice(0, Math.min(Number(limit) || 10, 30)).map(({ u }) => profiles.publicCard(userId, u)), quota: quota(userId) };
  }

  function targetOrThrow(userId, pid) {
    const t = profiles.getUserByPublic(pid);
    if (!t || t.id === userId || t.status !== 'active' || profiles.isBlocked(userId, t.id)) throw notFound('Esse perfil não está mais disponível.');
    return t;
  }

  function createMatchIfMutual(a, b) {
    const rev = db.get('SELECT 1 FROM likes WHERE from_id = ? AND to_id = ? AND active = 1', b, a);
    if (!rev) return null;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    // UNIQUE(user_a,user_b) garante um único match mesmo com requisições simultâneas.
    const r = db.run('INSERT OR IGNORE INTO matches(user_a, user_b, status, created_at) VALUES (?,?,?,?)', lo, hi, 'active', ctx.now());
    const m = db.get('SELECT * FROM matches WHERE user_a = ? AND user_b = ?', lo, hi);
    return { match: m, created: r.changes > 0 };
  }

  /** Curtir: idempotente por par; consome 1 unidade só quando a curtida é nova; saldo atômico. */
  function like(userId, pid) {
    viewerOrThrow(userId);
    const target = targetOrThrow(userId, pid);
    return db.tx(() => {
      const existing = db.get('SELECT * FROM likes WHERE from_id = ? AND to_id = ?', userId, target.id);
      if (existing) {
        if (!existing.active) throw conflict('unmatched', 'Vocês não estão mais conectados.');
        const m = db.get('SELECT * FROM matches WHERE user_a = ? AND user_b = ? AND status = ?', Math.min(userId, target.id), Math.max(userId, target.id), 'active');
        return { status: m ? 'matched' : 'already_liked', matchId: m ? m.id : null, quota: quota(userId) };
      }
      const endedMatch = db.get('SELECT 1 FROM matches WHERE user_a = ? AND user_b = ?', Math.min(userId, target.id), Math.max(userId, target.id));
      if (endedMatch) throw conflict('unmatched', 'Vocês não estão mais conectados.');
      const q = quota(userId);
      if (q.remaining <= 0) throw new HttpError(429, 'daily_limit', 'Você usou todas as curtidas de hoje.', { quota: q });
      const day = dayKey(ctx.now());
      db.run('INSERT INTO likes(from_id, to_id, active, day, created_at) VALUES (?,?,?,?,?)', userId, target.id, 1, day, ctx.now());
      db.run('INSERT INTO daily_likes(user_id, day, used) VALUES (?,?,1) ON CONFLICT(user_id, day) DO UPDATE SET used = used + 1', userId, day);
      db.run('DELETE FROM passes WHERE from_id = ? AND to_id = ?', userId, target.id);
      const res = createMatchIfMutual(userId, target.id);
      if (res && res.created) {
        const me = profiles.getProfile(userId), them = profiles.getProfile(target.id);
        ctx.notify(userId, 'match', 'Novo elo!', `Você e ${them.display_name} se curtiram.`, { matchId: res.match.id });
        ctx.notify(target.id, 'match', 'Novo elo!', `Você e ${me.display_name} se curtiram.`, { matchId: res.match.id });
        return { status: 'matched', matchId: res.match.id, quota: quota(userId) };
      }
      // Notificação genérica: nunca contém nome, foto ou identificador do remetente.
      ctx.notify(target.id, 'like', 'Alguém curtiu você', 'Veja em Matches.', null);
      return { status: 'liked', quota: quota(userId) };
    });
  }

  function pass(userId, pid) {
    viewerOrThrow(userId);
    const target = targetOrThrow(userId, pid);
    db.run('INSERT OR REPLACE INTO passes(from_id, to_id, created_at) VALUES (?,?,?)', userId, target.id, ctx.now());
    return { ok: true };
  }
  /** Plus/Premium: recupera o último perfil dispensado. Não reverte bloqueio, denúncia nem curtidas. */
  function undoPass(userId) {
    viewerOrThrow(userId);
    plans.requirePlan(userId, 'plus', 'Desfazer a última dispensa');
    const last = db.get(`SELECT ps.* FROM passes ps JOIN users u ON u.id = ps.to_id WHERE ps.from_id = ? AND u.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?1 AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ?1))
      ORDER BY ps.created_at DESC, ps.rowid DESC LIMIT 1`, userId);
    if (!last) throw notFound('Nenhum perfil dispensado para desfazer.');
    db.run('DELETE FROM passes WHERE from_id = ? AND to_id = ?', last.from_id, last.to_id);
    return { profile: profiles.publicCard(userId, profiles.getUser(last.to_id)) };
  }

  /** Quem curtiu: identidade só para Plus/Premium. Free recebe apenas a contagem agregada. */
  function likesReceived(userId) {
    viewerOrThrow(userId);
    const rows = db.all(`SELECT u.* FROM likes l JOIN users u ON u.id = l.from_id
      WHERE l.to_id = ? AND l.active = 1 AND u.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM matches m WHERE m.user_a = MIN(l.from_id, l.to_id) AND m.user_b = MAX(l.from_id, l.to_id))
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = l.to_id AND b.blocked_id = l.from_id) OR (b.blocker_id = l.from_id AND b.blocked_id = l.to_id))
      ORDER BY l.created_at DESC`, userId);
    if (plans.RANK[plans.planOf(userId)] < plans.RANK.plus) return { locked: true, count: rows.length, items: [] };
    return { locked: false, count: rows.length, items: rows.map((u) => profiles.publicCard(userId, u)) };
  }

  /** Perfil completo (registra visita elegível para a popularidade). */
  function viewProfile(userId, pid) {
    viewerOrThrow(userId);
    const t = profiles.getUserByPublic(pid);
    if (!t || t.status !== 'active' || profiles.isBlocked(userId, t.id)) throw notFound('Esse perfil não está mais disponível.');
    if (t.id !== userId) {
      const m = db.get('SELECT 1 FROM matches WHERE user_a = ? AND user_b = ? AND status = ?', Math.min(userId, t.id), Math.max(userId, t.id), 'active');
      const liked = db.get('SELECT 1 FROM likes WHERE from_id = ? AND to_id = ? AND active = 1', t.id, userId);
      const crossed = db.get('SELECT 1 FROM crossings WHERE user_a = ? AND user_b = ? AND expires_at > ?', Math.min(userId, t.id), Math.max(userId, t.id), ctx.now());
      const visible = m || liked || crossed || profiles.mutuallyCompatible(userId, t.id);
      if (!visible || (!m && plans.isDiscreet(t.id) && !db.get('SELECT 1 FROM likes WHERE from_id = ? AND to_id = ? AND active = 1', t.id, userId))) throw notFound('Esse perfil não está mais disponível.');
      if (profiles.approvedPhotos(t.id).length) db.run('INSERT OR IGNORE INTO profile_visits(visitor_id, visited_id, day) VALUES (?,?,?)', userId, t.id, dayKey(ctx.now()));
    }
    return profiles.publicCard(userId, t, { full: true });
  }

  return { quota, discover, like, pass, undoPass, likesReceived, viewProfile, createMatchIfMutual };
};
