PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  birth_date TEXT NOT NULL,              -- privado; idade pública é calculada
  status TEXT NOT NULL DEFAULT 'active', -- pending_verification|active|suspended|deleting|deleted
  role TEXT NOT NULL DEFAULT 'user',     -- user|support|moderator|admin
  email_verified_at INTEGER,
  is_demo INTEGER NOT NULL DEFAULT 0,
  terms_version TEXT,
  terms_accepted_at INTEGER,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER,
  purge_at INTEGER
);

CREATE TABLE IF NOT EXISTS age_blocklist (email_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS email_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                    -- verify|reset
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE IF NOT EXISTS outbox (        -- e-mails de desenvolvimento (sem provedor real)
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT 'nao_informar', -- mulher|homem|nao_binario|outra|nao_informar
  intent TEXT,                                 -- relacionamento|conhecer|casual|descobrindo
  smoking TEXT NOT NULL DEFAULT 'nao_informar',
  children TEXT NOT NULL DEFAULT 'nao_informar',
  drinking TEXT NOT NULL DEFAULT 'nao_informar',
  pets TEXT NOT NULL DEFAULT 'nao_informar',
  height_cm INTEGER,
  work TEXT NOT NULL DEFAULT '',
  education TEXT NOT NULL DEFAULT '',
  interests TEXT NOT NULL DEFAULT '[]',
  city TEXT,
  lat REAL, lng REAL,                          -- grade grossa (~1 km); nunca exposta a terceiros
  location_source TEXT,                        -- gps|manual
  location_updated_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system',        -- light|dark|system
  pause_discovery INTEGER NOT NULL DEFAULT 0,
  pause_paths INTEGER NOT NULL DEFAULT 0,
  discreet INTEGER NOT NULL DEFAULT 0,
  pref_age_min INTEGER NOT NULL DEFAULT 18,
  pref_age_max INTEGER NOT NULL DEFAULT 100,
  pref_distance_km INTEGER NOT NULL DEFAULT 50,
  pref_genders TEXT NOT NULL DEFAULT '[]',     -- [] = todos
  pref_intents TEXT NOT NULL DEFAULT '[]',     -- [] = todas
  show_gender INTEGER NOT NULL DEFAULT 1,       -- visibilidade de informações sensíveis
  show_habits INTEGER NOT NULL DEFAULT 1,
  notif_matches INTEGER NOT NULL DEFAULT 1,
  notif_messages INTEGER NOT NULL DEFAULT 1,
  notif_likes INTEGER NOT NULL DEFAULT 1,
  notif_ops INTEGER NOT NULL DEFAULT 1,
  notif_preview INTEGER NOT NULL DEFAULT 0,    -- prévia de mensagens discreta por padrão
  paths_consent_at INTEGER,
  paths_consent_version INTEGER,
  paths_revoked_at INTEGER,
  onboarding_done INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',      -- pending|approved|rejected
  storage_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  reject_reason TEXT,
  reviewed_by INTEGER, reviewed_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id, position);

CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active INTEGER NOT NULL DEFAULT 1,
  day TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(from_id, to_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_to ON likes(to_id, active);

CREATE TABLE IF NOT EXISTS passes (
  from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (from_id, to_id)
);

CREATE TABLE IF NOT EXISTS daily_likes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- user_a < user_b
  user_b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',       -- active|ended
  created_at INTEGER NOT NULL,
  ended_at INTEGER, ended_by INTEGER, ended_reason TEXT,
  last_message_at INTEGER,
  UNIQUE(user_a, user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',           -- text|invite|system
  body TEXT NOT NULL,
  invite_id INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(match_id, sender_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_messages_match ON messages(match_id, id);

CREATE TABLE IF NOT EXISTS match_reads (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, user_id)
);

CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  proposer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place TEXT NOT NULL,
  scheduled_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',     -- proposed|accepted|declined|cancelled
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  protocol TEXT NOT NULL UNIQUE,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity INTEGER NOT NULL DEFAULT 2,         -- 1 crítica, 2 alta, 3 normal
  details TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open',         -- open|in_review|resolved|dismissed
  assigned_to INTEGER, decision TEXT,
  created_at INTEGER NOT NULL, resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, severity, created_at);

CREATE TABLE IF NOT EXISTS sanctions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                          -- warning|suspension|ban|preventive
  reason TEXT NOT NULL,
  report_id INTEGER,
  by_user INTEGER, created_at INTEGER NOT NULL, lifted_at INTEGER,
  appeal_text TEXT, appeal_at INTEGER, appeal_status TEXT, appeal_decision TEXT, appeal_by INTEGER
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL, cycle TEXT NOT NULL,
  state TEXT NOT NULL,                         -- pending|active|renewal_cancelled|grace|expired|refunded|revoked
  provider TEXT NOT NULL, provider_ref TEXT UNIQUE,
  started_at INTEGER, current_period_end INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id, state);

CREATE TABLE IF NOT EXISTS purchase_events (
  provider TEXT NOT NULL, event_id TEXT NOT NULL, payload TEXT, processed_at INTEGER NOT NULL,
  PRIMARY KEY (provider, event_id)
);

CREATE TABLE IF NOT EXISTS boosts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL, ends_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_visits (
  visitor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visited_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  PRIMARY KEY (visitor_id, visited_id, day)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, data TEXT,
  created_at INTEGER NOT NULL, read_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);

CREATE TABLE IF NOT EXISTS location_signals (   -- retenção bruta: até 24 h
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat REAL NOT NULL, lng REAL NOT NULL, accuracy_m REAL NOT NULL,
  captured_at INTEGER NOT NULL, received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_signals_time ON location_signals(captured_at);
CREATE INDEX IF NOT EXISTS idx_signals_user ON location_signals(user_id, captured_at);

CREATE TABLE IF NOT EXISTS crossings (          -- derivado aproximado: até 7 dias
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL, period TEXT NOT NULL,      -- manhã|tarde|noite|madrugada (sem hora exata)
  area TEXT NOT NULL,                           -- nome de região aproximada, sem coordenadas
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  UNIQUE(user_a, user_b, day)
);

CREATE TABLE IF NOT EXISTS sensitive_zones (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT, lat REAL NOT NULL, lng REAL NOT NULL, radius_m REAL NOT NULL);

CREATE TABLE IF NOT EXISTS parameters (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_by INTEGER, updated_at INTEGER);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER, action TEXT NOT NULL, target_type TEXT, target_id TEXT,
  justification TEXT, meta TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at);
