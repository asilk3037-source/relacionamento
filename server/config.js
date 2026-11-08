'use strict';
// Configuração central. Valores marcados "hipótese" vêm da documentação e devem ser calibrados no piloto.
const path = require('path');
const env = process.env;
const prod = env.NODE_ENV === 'production';
const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);
const bool = (v, d) => (v === undefined ? d : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));

module.exports = {
  prod,
  port: num(env.PORT, 3000),
  dbPath: env.DB_PATH || path.join(__dirname, '..', 'data', 'elo.db'),
  uploadDir: env.UPLOAD_DIR || path.join(__dirname, '..', 'data', 'uploads'),
  publicDir: path.join(__dirname, '..', 'public'),
  // Segredo para assinar URLs de mídia. Em produção é obrigatório.
  mediaSecret: env.MEDIA_SECRET || (prod ? null : 'dev-only-media-secret'),
  timezone: 'America/Sao_Paulo',
  minAge: 18,
  termsVersion: '2026-11-08',
  sessionTtlDays: 30,
  staffSessionTtlHours: 8,
  requireEmailVerification: bool(env.REQUIRE_EMAIL_VERIFICATION, prod),
  autoApprovePhotos: bool(env.AUTO_APPROVE_PHOTOS, !prod), // em produção, fotos exigem moderação
  exposeDevOutbox: !prod,
  limits: { nameMax: 40, bioMax: 500, interestsMax: 8, messageMax: 2000, photosMin: 1, photosMax: 6, photoMaxBytes: 5 * 1024 * 1024, heightMin: 100, heightMax: 250 },
  // Curtidas por dia. Podem ser ajustadas por admin (tabela parameters).
  dailyLikes: { free: 20, plus: 100, premium: 200 },
  resurfacePassedDays: num(env.RESURFACE_PASSED_DAYS, 30), // decisão pendente: reapresentação de perfis dispensados
  deletePurgeDays: 30,
  plans: {
    plus: { name: 'Elo Plus', month: 19.9, year: 179.9 },
    premium: { name: 'Elo Premium', month: 34.9, year: 299.9 },
  },
  graceDays: 3,
  boost: { durationMin: 30, windowDays: 7 },
  // Caminhos cruzados — hipóteses técnicas do piloto (documentação, seção 5).
  paths: {
    maxAccuracyM: num(env.PATHS_MAX_ACCURACY_M, 100),
    maxDistanceM: num(env.PATHS_MAX_DISTANCE_M, 200),
    maxTimeDiffMin: num(env.PATHS_MAX_TIME_DIFF_MIN, 15),
    minDelayMin: num(env.PATHS_MIN_DELAY_MIN, 60),
    rawRetentionH: 24,
    crossingRetentionD: 7,
    minDensity: num(env.PATHS_MIN_DENSITY, 3), // usuários distintos na mesma região/janela (supressão de baixa densidade)
    maxSignalsPerHour: 12,
    consentVersion: 1,
  },
  popularityWindowDays: 7,
  google: { packageName: env.GOOGLE_PLAY_PACKAGE || null, webhookSecret: env.GOOGLE_PLAY_WEBHOOK_SECRET || null },
  cities: [
    { id: 'bh', name: 'Belo Horizonte', lat: -19.92, lng: -43.94 },
    { id: 'sp', name: 'São Paulo', lat: -23.55, lng: -46.63 },
    { id: 'rj', name: 'Rio de Janeiro', lat: -22.91, lng: -43.17 },
    { id: 'bsb', name: 'Brasília', lat: -15.79, lng: -47.88 },
    { id: 'ssa', name: 'Salvador', lat: -12.97, lng: -38.5 },
    { id: 'for', name: 'Fortaleza', lat: -3.73, lng: -38.52 },
    { id: 'cwb', name: 'Curitiba', lat: -25.43, lng: -49.27 },
    { id: 'poa', name: 'Porto Alegre', lat: -30.03, lng: -51.23 },
    { id: 'rec', name: 'Recife', lat: -8.05, lng: -34.88 },
    { id: 'gyn', name: 'Goiânia', lat: -16.68, lng: -49.25 },
    { id: 'cpq', name: 'Campinas', lat: -22.9, lng: -47.06 },
    { id: 'vix', name: 'Vitória', lat: -20.32, lng: -40.34 },
    { id: 'fln', name: 'Florianópolis', lat: -27.6, lng: -48.55 },
  ],
};
