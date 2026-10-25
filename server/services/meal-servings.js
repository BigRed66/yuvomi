/**
 * Modul: Personenzahl je Mahlzeit (Fork-Erweiterung)
 * Zweck: Speichert, fuer wie viele Personen eine geplante Mahlzeit gedacht ist.
 *        Der Wert ist der Skalierungsfaktor fuer das verknuepfte Rezept: die
 *        Rezepte im Haushalt sind pro Person angelegt, Faktor 3 = 3 Personen.
 *
 * BEWUSST AUSSERHALB DER MIGRATIONEN. Eine eigene Migration bekaeme die naechste
 * Versionsnummer, und bringt upstream spaeter eine Migration mit derselben
 * Nummer, wuerde sie in diesem Fork still uebersprungen. Die Tabelle entsteht
 * deshalb mit CREATE TABLE IF NOT EXISTS beim ersten Zugriff und haengt nicht
 * per Fremdschluessel an `meals`: Tabellen-Rebuilds in kuenftigen Migrationen
 * (RENAME bei abgeschalteten foreign_keys) koennten einen Fremdschluessel sonst
 * auf eine umbenannte Tabelle umbiegen. Verwaiste Zeilen sind harmlos, gelesen
 * wird nur ueber vorhandene meal_ids; geloescht wird mit der Mahlzeit.
 */

import * as db from '../db.js';

const MAX_SERVINGS = 99;
let ready = false;

function ensureTable() {
  if (ready) return;
  db.get().exec(`
    CREATE TABLE IF NOT EXISTS fork_meal_servings (
      meal_id  INTEGER PRIMARY KEY,
      servings REAL    NOT NULL
    )
  `);
  ready = true;
}

/**
 * Prueft den Wert aus dem Request.
 * undefined = nicht mitgeschickt, null/'' = loeschen, sonst Zahl 0,1–99.
 * @returns {{ given: boolean, value: number|null, error: string|null }}
 */
export function servingsField(raw) {
  if (raw === undefined) return { given: false, value: null, error: null };
  if (raw === null || raw === '') return { given: true, value: null, error: null };
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > MAX_SERVINGS) {
    return { given: true, value: null, error: `Personen muss zwischen 0,1 und ${MAX_SERVINGS} liegen.` };
  }
  return { given: true, value: Math.round(n * 100) / 100, error: null };
}

/** Personenzahl fuer eine Mahlzeit setzen (null loescht sie). */
export function setServings(mealId, value) {
  ensureTable();
  if (value === null || value === undefined) {
    db.get().prepare('DELETE FROM fork_meal_servings WHERE meal_id = ?').run(mealId);
    return;
  }
  db.get().prepare(`
    INSERT INTO fork_meal_servings (meal_id, servings) VALUES (?, ?)
    ON CONFLICT(meal_id) DO UPDATE SET servings = excluded.servings
  `).run(mealId, value);
}

/** Map meal_id -> servings fuer eine Liste von Mahlzeiten. */
export function servingsMap(mealIds) {
  ensureTable();
  if (!mealIds.length) return {};
  const rows = db.get().prepare(`
    SELECT meal_id, servings FROM fork_meal_servings
    WHERE meal_id IN (${mealIds.map(() => '?').join(',')})
  `).all(...mealIds);
  return Object.fromEntries(rows.map((r) => [r.meal_id, r.servings]));
}

/** Personenzahl einer Mahlzeit oder null. */
export function servingsFor(mealId) {
  return servingsMap([mealId])[mealId] ?? null;
}

/** Mit der Mahlzeit loeschen (kein Fremdschluessel, siehe Kopf). */
export function deleteServings(mealIds) {
  ensureTable();
  const ids = [].concat(mealIds).filter((x) => x !== null && x !== undefined);
  if (!ids.length) return;
  db.get().prepare(`DELETE FROM fork_meal_servings WHERE meal_id IN (${ids.map(() => '?').join(',')})`).run(...ids);
}
