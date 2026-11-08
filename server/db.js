'use strict';
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

/** Envoltório fino sobre node:sqlite com cache de statements e transações imediatas. */
function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  raw.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const cache = new Map();
  const stmt = (sql) => { let s = cache.get(sql); if (!s) { s = raw.prepare(sql); cache.set(sql, s); } return s; };
  const clean = (p) => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
  let depth = 0;
  const db = {
    raw,
    get: (sql, ...p) => stmt(sql).get(...clean(p)),
    all: (sql, ...p) => stmt(sql).all(...clean(p)),
    run: (sql, ...p) => stmt(sql).run(...clean(p)),
    exec: (sql) => raw.exec(sql),
    /** Transação atômica; aninhamento reutiliza a transação externa. */
    tx(fn) {
      if (depth > 0) return fn();
      raw.exec('BEGIN IMMEDIATE'); depth++;
      try { const r = fn(); raw.exec('COMMIT'); return r; }
      catch (e) { try { raw.exec('ROLLBACK'); } catch { /* já encerrada */ } throw e; }
      finally { depth--; }
    },
    close: () => raw.close(),
  };
  return db;
}
module.exports = { openDb };
