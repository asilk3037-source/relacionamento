'use strict';
const { dayKey, DAY } = require('../lib/time');

module.exports = (ctx) => {
  const { db, config } = ctx;
  /** Painel privado e agregado. Sem identificar visitantes, sem classificação e sem ranking. */
  function summary(userId) {
    const now = ctx.now();
    const since = now - config.popularityWindowDays * DAY;
    const sinceDay = dayKey(since);
    const u = db.get('SELECT created_at FROM users WHERE id = ?', userId);
    const visits = db.get('SELECT COUNT(*) n FROM profile_visits v JOIN users x ON x.id = v.visitor_id WHERE v.visited_id = ? AND v.day >= ? AND x.status = ?', userId, sinceDay, 'active').n;
    const likes = db.get('SELECT COUNT(*) n FROM likes WHERE to_id = ? AND created_at > ?', userId, since).n;
    const matches = db.get('SELECT COUNT(*) n FROM matches WHERE (user_a = ?1 OR user_b = ?1) AND created_at > ?2', userId, since).n;
    const ageDays = (now - u.created_at) / DAY;
    return { windowDays: config.popularityWindowDays, visits, likes, matches, enoughData: ageDays >= 2, accountAgeDays: Math.floor(ageDays) };
  }
  return { summary };
};
