'use strict';
const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function haversineM(lat1, lng1, lat2, lng2) {
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
/** Faixas de distância: nunca coordenadas ou distância exata. */
function distanceBand(km) {
  if (km == null) return null;
  if (km < 5) return 'menos de 5 km';
  if (km < 10) return '5–10 km';
  if (km < 25) return '10–25 km';
  if (km < 50) return '25–50 km';
  return 'mais de 50 km';
}
const coarse = (v) => Math.round(v * 100) / 100; // ~1 km
function validCoords(lat, lng) { return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180; }
module.exports = { haversineM, distanceBand, coarse, validCoords };
