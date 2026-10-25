/**
 * Fork-Erweiterung: Personenzahl / Skalierung im Rezept.
 *
 * Die Rezepte des Haushalts sind pro Person gespeichert (Faktor = Personen).
 * Diese Datei haelt den gewaehlten Faktor je Rezept fuer die laufende Sitzung
 * und rechnet Mengenangaben um. Bewusst eigenstaendig statt aus meals.js
 * importiert, damit Updates von upstream hier nichts verschieben.
 *
 * Gerechnet wird wie in meals.js `scaleQuantityText`: nur eine Zahl am Anfang
 * („450 g", „0,5 Bund", „1 1/2 EL", „1/2 TL"); Text wie „nach Geschmack" bleibt.
 */

const factors = new Map();

export const MIN_SERVINGS = 0.5;
export const MAX_SERVINGS = 99;

/** Faktor fuer ein Rezept (Standard 1). */
export function recipeFactor(recipeId) {
  return factors.get(String(recipeId)) ?? 1;
}

/** Faktor setzen; ungueltige Werte werden ignoriert. */
export function setRecipeFactor(recipeId, value) {
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return recipeFactor(recipeId);
  const v = Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(n * 100) / 100));
  factors.set(String(recipeId), v);
  return v;
}

/** Uebernimmt `?open=<id>&scale=<n>` aus der Adresse (Kochmuetze im Wochenplan). */
export function adoptFactorFromQuery(search = window.location.search) {
  const p = new URLSearchParams(search);
  const id = p.get('open');
  const scale = p.get('scale');
  if (id && scale) setRecipeFactor(id, scale);
}

function fmt(x) {
  // Pro-Person-Mengen sind gerundet gespeichert (1/3 = 0,33): 0,99 soll als 1 erscheinen.
  const whole = Math.round(x);
  if (whole > 0 && Math.abs(x - whole) <= 0.05 * Math.max(1, whole)) return String(whole);
  const r = Math.round(x * 100) / 100;
  return String(r).replace('.', ',');
}

/** Mengenangabe mit Faktor umrechnen. */
export function scaleQuantity(quantity, factor) {
  if (!quantity || factor === 1) return quantity ?? '';
  const s = String(quantity).trim();
  let m = s.match(/^(\d+)\s+(\d+)\/(\d+)(.*)$/);
  if (m && Number(m[3]) > 0) return fmt((Number(m[1]) + Number(m[2]) / Number(m[3])) * factor) + m[4];
  m = s.match(/^(\d+)\/(\d+)(.*)$/);
  if (m && Number(m[2]) > 0) return fmt((Number(m[1]) / Number(m[2])) * factor) + m[3];
  m = s.match(/^(\d+(?:[.,]\d+)?)(.*)$/);
  if (m) {
    // „1.000 g" (Tausenderpunkt) nicht als 1,0 lesen
    if (/^\d{1,3}\.\d{3}\b/.test(s)) return s;
    return fmt(Number(m[1].replace(',', '.')) * factor) + m[2];
  }
  return s;
}

/** „3 Personen" / „1 Person" */
export function servingsText(n) {
  return `${fmt(n)} ${Number(n) === 1 ? 'Person' : 'Personen'}`;
}
