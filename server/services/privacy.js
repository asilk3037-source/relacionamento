'use strict';
const fs = require('fs');
const path = require('path');
const { DAY } = require('../lib/time');

module.exports = (ctx, { profiles, plans }) => {
  const { db, config } = ctx;

  /** Exportação dos dados do próprio usuário. Não inclui dados privados de terceiros. */
  function exportData(userId) {
    const u = profiles.getUser(userId);
    const p = profiles.getProfile(userId);
    const s = profiles.getSettings(userId);
    const matches = db.all('SELECT * FROM matches WHERE user_a = ?1 OR user_b = ?1', userId).map((m) => {
      const otherId = m.user_a === userId ? m.user_b : m.user_a;
      const o = profiles.getProfile(otherId);
      return {
        id: m.id, with: o ? o.display_name : null, status: m.status, createdAt: m.created_at,
        myMessages: db.all('SELECT body, kind, created_at FROM messages WHERE match_id = ? AND sender_id = ? ORDER BY id', m.id, userId),
      };
    });
    return {
      exportedAt: ctx.now(),
      account: { email: u.email, birthDate: u.birth_date, createdAt: u.created_at, termsVersion: u.terms_version, termsAcceptedAt: u.terms_accepted_at },
      profile: { ...p, interests: profiles.json(p.interests, []) },
      settings: s,
      photos: db.all('SELECT public_id id, status, created_at FROM photos WHERE user_id = ?', userId),
      likesSent: db.get('SELECT COUNT(*) n FROM likes WHERE from_id = ?', userId).n,
      likesReceivedCount: db.get('SELECT COUNT(*) n FROM likes WHERE to_id = ?', userId).n,
      matches,
      subscriptions: db.all('SELECT plan, cycle, state, provider, started_at, current_period_end FROM subscriptions WHERE user_id = ?', userId),
      blocks: db.get('SELECT COUNT(*) n FROM blocks WHERE blocker_id = ?', userId).n,
      consentPaths: { consentAt: s.paths_consent_at, revokedAt: s.paths_revoked_at, version: s.paths_consent_version },
    };
  }

  /** Limpeza programada após o prazo de exclusão: apaga arquivos, perfil e derivados. */
  function purgeDeleted() {
    const now = ctx.now();
    const due = db.all("SELECT id FROM users WHERE status = 'deleting' AND purge_at <= ?", now);
    for (const { id } of due) {
      for (const ph of db.all('SELECT storage_key FROM photos WHERE user_id = ?', id)) if (!ph.storage_key.startsWith('seed:')) fs.rmSync(path.join(config.uploadDir, ph.storage_key), { force: true });
      db.tx(() => {
        // Mensagens das conversas encerradas por exclusão são removidas (política proposta; retenção ainda é decisão pendente).
        db.run('DELETE FROM matches WHERE user_a = ? OR user_b = ?', id, id);
        const stamp = `deleted-${id}`;
        db.run("UPDATE users SET status = 'deleted', email = ?, password_hash = '', public_id = ?, birth_date = '1900-01-01' WHERE id = ?", `${stamp}@deleted.invalid`, stamp, id);
        db.run("UPDATE profiles SET display_name = '', bio = '', interests = '[]', work = '', education = '', lat = NULL, lng = NULL, city = NULL WHERE user_id = ?", id);
        for (const t of ['photos', 'likes', 'passes', 'daily_likes', 'blocks', 'notifications', 'profile_visits', 'location_signals', 'boosts', 'sessions', 'email_tokens']) {
          const col = { likes: 'from_id', passes: 'from_id', blocks: 'blocker_id', profile_visits: 'visitor_id' }[t] || 'user_id';
          db.run(`DELETE FROM ${t} WHERE ${col} = ?`, id);
        }
        db.run('DELETE FROM likes WHERE to_id = ?', id);
        db.run('DELETE FROM passes WHERE to_id = ?', id);
        db.run('DELETE FROM blocks WHERE blocked_id = ?', id);
        db.run('DELETE FROM profile_visits WHERE visited_id = ?', id);
      });
      ctx.audit(null, 'account.purged', 'user', id);
    }
    return due.length;
  }
  return { exportData, purgeDeleted };
};
