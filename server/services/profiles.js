'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { bad, notFound, forbidden } = require('../lib/errors');
const { ageFrom } = require('../lib/time');
const { haversineM, distanceBand, coarse, validCoords } = require('../lib/geo');
const { sanitizeImage } = require('../lib/images');

const ENUMS = {
  gender: ['mulher', 'homem', 'nao_binario', 'outra', 'nao_informar'],
  intent: ['relacionamento', 'conhecer', 'casual', 'descobrindo'],
  smoking: ['nao_fumo', 'as_vezes', 'fumo', 'parando', 'nao_informar'],
  children: ['tenho', 'nao_tenho', 'nao_informar'],
  drinking: ['nao_bebo', 'socialmente', 'bebo', 'nao_informar'],
  pets: ['tenho_cachorro', 'tenho_gato', 'tenho_outros', 'gosto', 'nao_tenho', 'nao_informar'],
};
const GENDER_PREF = ['mulher', 'homem', 'nao_binario', 'outra'];
const THEMES = ['light', 'dark', 'system'];
const DISTANCES = [5, 10, 25, 50, 100, 200];

module.exports = (ctx) => {
  const { db, config } = ctx;
  const L = config.limits;
  const str = (v, max, field) => {
    const s = String(v ?? '').replace(/\s+/g, ' ').trim();
    if (s.length > max) throw bad('too_long', `${field} aceita até ${max} caracteres.`);
    return s;
  };
  const oneOf = (v, list, field) => { if (!list.includes(v)) throw bad('invalid_value', `Valor inválido em ${field}.`); return v; };
  const json = (s, d) => { try { return JSON.parse(s); } catch { return d; } };

  const getUser = (id) => db.get('SELECT * FROM users WHERE id = ?', id);
  const getUserByPublic = (pid) => db.get('SELECT * FROM users WHERE public_id = ?', String(pid));
  const getProfile = (id) => db.get('SELECT * FROM profiles WHERE user_id = ?', id);
  const getSettings = (id) => db.get('SELECT * FROM settings WHERE user_id = ?', id);
  const isBlocked = (a, b) => !!db.get('SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)', a, b, b, a);
  const approvedPhotos = (id) => db.all("SELECT * FROM photos WHERE user_id = ? AND status = 'approved' ORDER BY position, id", id);

  // ---- URLs de mídia assinadas (img não envia cabeçalho Authorization) ----
  function sign(photoPid, viewerId, exp) { return crypto.createHmac('sha256', config.mediaSecret).update(`${photoPid}.${viewerId}.${exp}`).digest('base64url').slice(0, 32); }
  function mediaUrl(photoPid, viewerId) {
    const exp = ctx.now() + 3600000;
    return `/media/${photoPid}?v=${viewerId}&e=${exp}&s=${sign(photoPid, viewerId, exp)}`;
  }
  function openMedia(photoPid, q) {
    const viewerId = Number(q.v), exp = Number(q.e);
    const sig = String(q.s || '');
    const good = sign(photoPid, viewerId, exp);
    if (!exp || exp < ctx.now() || sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) throw forbidden('bad_media_link', 'Link de imagem expirado.');
    const ph = db.get('SELECT * FROM photos WHERE public_id = ?', photoPid);
    if (!ph) throw notFound();
    const owner = getUser(ph.user_id), viewer = getUser(viewerId);
    if (!owner || !viewer) throw notFound();
    const staff = ['moderator', 'admin'].includes(viewer.role);
    const self = owner.id === viewer.id;
    if (!self && !staff) {
      if (ph.status !== 'approved' || owner.status !== 'active' || isBlocked(owner.id, viewer.id)) throw notFound();
    }
    const file = ph.storage_key.startsWith('seed:') ? path.join(config.uploadDir, ph.storage_key.slice(5)) : path.join(config.uploadDir, ph.storage_key);
    if (!file.startsWith(config.uploadDir)) throw notFound();
    return { file, mime: ph.mime };
  }

  // ---- Distância e compatibilidade ----
  function distanceKm(a, b) {
    if (a.lat == null || b.lat == null) return null;
    return haversineM(a.lat, a.lng, b.lat, b.lng) / 1000;
  }
  /** Compatibilidade num sentido: `viewer` pode ver `cand`? (idade, gênero, intenção, distância). */
  function wants(viewerProfile, viewerSettings, viewerAge, cand, candAge) {
    if (candAge < viewerSettings.pref_age_min || candAge > viewerSettings.pref_age_max) return false;
    const g = json(viewerSettings.pref_genders, []);
    if (g.length && !g.includes(cand.gender)) return false;
    const it = json(viewerSettings.pref_intents, []);
    if (it.length && !it.includes(cand.intent)) return false;
    const d = distanceKm(viewerProfile, cand);
    if (d != null && d > viewerSettings.pref_distance_km) return false;
    return true;
  }
  /** Compatibilidade recíproca aplicada sempre no servidor. */
  function mutuallyCompatible(aId, bId) {
    const [pa, pb, sa, sb, ua, ub] = [getProfile(aId), getProfile(bId), getSettings(aId), getSettings(bId), getUser(aId), getUser(bId)];
    const now = ctx.now();
    return wants(pa, sa, ageFrom(ua.birth_date, now), pb, ageFrom(ub.birth_date, now)) && wants(pb, sb, ageFrom(ub.birth_date, now), pa, ageFrom(ua.birth_date, now));
  }

  function isComplete(userId) {
    const p = getProfile(userId);
    return !!(p && p.display_name && p.intent);
  }

  /** Cartão público. Nunca expõe e-mail, nascimento, coordenadas ou distância exata. */
  function publicCard(viewerId, row, { full = false } = {}) {
    const p = getProfile(row.id), s = getSettings(row.id);
    const viewerProfile = getProfile(viewerId);
    const km = viewerId === row.id ? null : distanceKm(viewerProfile, p);
    const photos = (viewerId === row.id ? db.all('SELECT * FROM photos WHERE user_id = ? ORDER BY position, id', row.id) : approvedPhotos(row.id))
      .map((ph) => ({ id: ph.public_id, url: mediaUrl(ph.public_id, viewerId), status: ph.status }));
    const card = {
      id: row.public_id,
      name: p.display_name,
      age: ageFrom(row.birth_date, ctx.now()),
      intent: p.intent,
      bio: p.bio,
      interests: json(p.interests, []),
      distance: distanceBand(km),
      photos,
      demo: !!row.is_demo,
    };
    if (s.show_gender || viewerId === row.id) card.gender = p.gender;
    if (full) {
      if (s.show_habits || viewerId === row.id) Object.assign(card, { smoking: p.smoking, children: p.children, drinking: p.drinking, pets: p.pets, heightCm: p.height_cm, work: p.work, education: p.education });
      card.city = p.city;
    }
    return card;
  }

  // ---- Perfil ----
  function updateProfile(userId, b) {
    const p = getProfile(userId);
    const next = { ...p };
    if (b.displayName !== undefined) { next.display_name = str(b.displayName, L.nameMax, 'Nome'); if (!next.display_name) throw bad('name_required', 'Informe um nome de exibição.'); }
    if (b.bio !== undefined) next.bio = str(b.bio, L.bioMax, 'A descrição');
    for (const k of ['gender', 'intent', 'smoking', 'children', 'drinking', 'pets']) if (b[k] !== undefined) next[k] = oneOf(b[k], ENUMS[k], k);
    if (b.heightCm !== undefined) {
      if (b.heightCm === null || b.heightCm === '') next.height_cm = null;
      else { const h = Number(b.heightCm); if (!Number.isInteger(h) || h < L.heightMin || h > L.heightMax) throw bad('invalid_height', `A altura deve ficar entre ${L.heightMin} e ${L.heightMax} cm.`); next.height_cm = h; }
    }
    if (b.work !== undefined) next.work = str(b.work, 60, 'Profissão');
    if (b.education !== undefined) next.education = str(b.education, 60, 'Escolaridade');
    if (b.interests !== undefined) {
      if (!Array.isArray(b.interests)) throw bad('invalid_value', 'Interesses inválidos.');
      const seen = new Set(); const out = [];
      for (const raw of b.interests) { const t = str(raw, 24, 'Interesse'); const k = t.toLowerCase(); if (t && !seen.has(k)) { seen.add(k); out.push(t); } }
      if (out.length > L.interestsMax) throw bad('too_many', `Escolha até ${L.interestsMax} interesses.`);
      next.interests = JSON.stringify(out);
    }
    db.run(`UPDATE profiles SET display_name=?, bio=?, gender=?, intent=?, smoking=?, children=?, drinking=?, pets=?, height_cm=?, work=?, education=?, interests=?, version=version+1, updated_at=? WHERE user_id=?`,
      next.display_name, next.bio, next.gender, next.intent, next.smoking, next.children, next.drinking, next.pets, next.height_cm, next.work, next.education, next.interests, ctx.now(), userId);
    return getProfile(userId);
  }

  function updateSettings(userId, b) {
    const s = getSettings(userId); const n = { ...s };
    if (b.theme !== undefined) n.theme = oneOf(b.theme, THEMES, 'tema');
    for (const k of ['pause_discovery', 'pause_paths', 'show_gender', 'show_habits', 'notif_matches', 'notif_messages', 'notif_likes', 'notif_ops', 'notif_preview', 'onboarding_done']) {
      const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (b[camel] !== undefined) n[k] = b[camel] ? 1 : 0;
    }
    if (b.prefs) {
      const x = b.prefs;
      if (x.ageMin !== undefined) n.pref_age_min = x.ageMin;
      if (x.ageMax !== undefined) n.pref_age_max = x.ageMax;
      if (!Number.isInteger(n.pref_age_min) || !Number.isInteger(n.pref_age_max) || n.pref_age_min < 18 || n.pref_age_max > 100 || n.pref_age_min > n.pref_age_max) throw bad('invalid_age_range', 'Faixa de idade inválida (18 a 100).');
      if (x.distanceKm !== undefined) n.pref_distance_km = oneOf(Number(x.distanceKm), DISTANCES, 'distância');
      if (x.genders !== undefined) { if (!Array.isArray(x.genders) || x.genders.some((g) => !GENDER_PREF.includes(g))) throw bad('invalid_value', 'Gêneros inválidos.'); n.pref_genders = JSON.stringify([...new Set(x.genders)]); }
      if (x.intents !== undefined) { if (!Array.isArray(x.intents) || x.intents.some((g) => !ENUMS.intent.includes(g))) throw bad('invalid_value', 'Intenções inválidas.'); n.pref_intents = JSON.stringify([...new Set(x.intents)]); }
    }
    db.run(`UPDATE settings SET theme=?, pause_discovery=?, pause_paths=?, show_gender=?, show_habits=?, notif_matches=?, notif_messages=?, notif_likes=?, notif_ops=?, notif_preview=?, onboarding_done=?, pref_age_min=?, pref_age_max=?, pref_distance_km=?, pref_genders=?, pref_intents=? WHERE user_id=?`,
      n.theme, n.pause_discovery, n.pause_paths, n.show_gender, n.show_habits, n.notif_matches, n.notif_messages, n.notif_likes, n.notif_ops, n.notif_preview, n.onboarding_done, n.pref_age_min, n.pref_age_max, n.pref_distance_km, n.pref_genders, n.pref_intents, userId);
    return getSettings(userId);
  }

  function setLocation(userId, b) {
    if (b.mode === 'manual') {
      const c = config.cities.find((x) => x.id === b.cityId);
      if (!c) throw bad('invalid_city', 'Cidade inválida.');
      db.run('UPDATE profiles SET lat=?, lng=?, city=?, location_source=?, location_updated_at=? WHERE user_id=?', c.lat, c.lng, c.name, 'manual', ctx.now(), userId);
    } else if (b.mode === 'gps') {
      const lat = Number(b.lat), lng = Number(b.lng);
      if (!validCoords(lat, lng)) throw bad('invalid_coords', 'Localização inválida.');
      let near = null, best = 60000;
      for (const c of config.cities) { const d = haversineM(lat, lng, c.lat, c.lng); if (d < best) { best = d; near = c; } }
      db.run('UPDATE profiles SET lat=?, lng=?, city=?, location_source=?, location_updated_at=? WHERE user_id=?', coarse(lat), coarse(lng), near ? near.name : null, 'gps', ctx.now(), userId);
    } else throw bad('invalid_mode', 'Modo de localização inválido.');
    const p = getProfile(userId);
    return { city: p.city, source: p.location_source };
  }

  // ---- Fotos ----
  function addPhoto(userId, buffer) {
    const count = db.get('SELECT COUNT(*) n FROM photos WHERE user_id = ?', userId).n;
    if (count >= L.photosMax) throw bad('too_many_photos', `Você pode ter até ${L.photosMax} fotos.`);
    const { mime, data } = sanitizeImage(buffer, L.photoMaxBytes);
    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp';
    const key = `${crypto.randomUUID()}.${ext}`;
    fs.mkdirSync(config.uploadDir, { recursive: true });
    fs.writeFileSync(path.join(config.uploadDir, key), data, { mode: 0o600 });
    const status = config.autoApprovePhotos ? 'approved' : 'pending';
    const pid = ctx.publicId();
    db.run('INSERT INTO photos(public_id, user_id, position, status, storage_key, mime, bytes, created_at) VALUES (?,?,?,?,?,?,?,?)', pid, userId, count, status, key, mime, data.length, ctx.now());
    return { id: pid, status };
  }
  function removePhoto(userId, pid) {
    const ph = db.get('SELECT * FROM photos WHERE public_id = ? AND user_id = ?', pid, userId);
    if (!ph) throw notFound();
    db.tx(() => {
      db.run('DELETE FROM photos WHERE id = ?', ph.id);
      db.all('SELECT id FROM photos WHERE user_id = ? ORDER BY position, id', userId).forEach((r, i) => db.run('UPDATE photos SET position = ? WHERE id = ?', i, r.id));
    });
    if (!ph.storage_key.startsWith('seed:')) fs.rm(path.join(config.uploadDir, ph.storage_key), { force: true }, () => {});
  }
  function orderPhotos(userId, ids) {
    const mine = db.all('SELECT public_id FROM photos WHERE user_id = ?', userId).map((r) => r.public_id);
    if (!Array.isArray(ids) || ids.length !== mine.length || ids.some((i) => !mine.includes(i)) || new Set(ids).size !== ids.length) throw bad('invalid_order', 'Ordem de fotos inválida.');
    db.tx(() => ids.forEach((pid, i) => db.run('UPDATE photos SET position = ? WHERE public_id = ? AND user_id = ?', i, pid, userId)));
  }

  return { ENUMS, getUser, getUserByPublic, getProfile, getSettings, isBlocked, approvedPhotos, mediaUrl, openMedia, distanceKm, mutuallyCompatible, wants, isComplete, publicCard, updateProfile, updateSettings, setLocation, addPhoto, removePhoto, orderPhotos, json };
};
