'use strict';
const config = require('../config');
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, hour: '2-digit', hour12: false });
/** Data (AAAA-MM-DD) em America/Sao_Paulo, sempre calculada a partir do relógio do servidor. */
const dayKey = (ms) => fmt.format(new Date(ms));
const hourOf = (ms) => Number(hourFmt.format(new Date(ms))) % 24;
const periodOf = (ms) => { const h = hourOf(ms); return h < 6 ? 'madrugada' : h < 12 ? 'manhã' : h < 18 ? 'tarde' : 'noite'; };
/** Próxima meia-noite em São Paulo (UTC-3, sem horário de verão desde 2019). */
const nextMidnight = (ms) => { const [y, m, d] = dayKey(ms).split('-').map(Number); return Date.UTC(y, m - 1, d + 1, 3, 0, 0); };
const ageFrom = (birth, ms) => {
  const [y, m, d] = birth.split('-').map(Number); const [ty, tm, td] = dayKey(ms).split('-').map(Number);
  let a = ty - y; if (tm < m || (tm === m && td < d)) a--; return a;
};
const DAY = 86400000, HOUR = 3600000, MIN = 60000;
module.exports = { dayKey, hourOf, periodOf, nextMidnight, ageFrom, DAY, HOUR, MIN };
