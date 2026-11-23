// Camada de dados. Cada coleção é um arquivo JSON em /data com o mesmo envelope:
// { schema, version, updatedAt, items: [...] }  (settings.json usa campos em vez de items)
// Local (serve.ps1): lê e grava.  GitHub Pages: somente leitura.

import { nowISO } from './util.js';

export const SCHEMAS = {
  'settings': 'planlife.settings',
  'routine/blocks': 'planlife.routine.block',
  'routine/logs': 'planlife.routine.log',
  'focus/modes': 'planlife.focus.mode',
  'focus/cycles': 'planlife.focus.cycle',
  'ai/suggestions': 'planlife.ai.suggestion',
  'finance/accounts': 'planlife.finance.account',
  'finance/snapshots': 'planlife.finance.snapshot',
  'finance/goals': 'planlife.finance.goal',
  'vault/vault.enc': 'planlife.vault',
};

const cache = new Map();
const listeners = new Set();
let mode = 'unknown';

export class ReadOnlyError extends Error {
  constructor() { super('Somente leitura: edite pelo PC com o servidor local (start.cmd).'); }
}

export async function init() {
  try {
    const r = await fetch('api/health', { cache: 'no-store' });
    const j = r.ok ? await r.json() : null;
    mode = j && j.ok ? 'local' : 'readonly';
  } catch { mode = 'readonly'; }
  return mode;
}
export const getMode = () => mode;
export const canWrite = () => mode === 'local';
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (path) => listeners.forEach((fn) => fn(path));

function schemaFor(path) {
  const key = Object.keys(SCHEMAS).find((k) => path === k || path.startsWith(k + '/'));
  return SCHEMAS[key] || `planlife.${path.replace(/\//g, '.')}`;
}
export const envelope = (path, items = []) => ({ schema: schemaFor(path), version: 1, updatedAt: nowISO(), items });

/** Lê data/<path>.json. Se não existir, devolve um envelope vazio (ou `fallback`). */
export async function load(path, fallback) {
  if (cache.has(path)) return cache.get(path);
  let doc = null;
  try {
    const r = await fetch(`data/${path}.json?t=${Date.now()}`, { cache: 'no-store' });
    if (r.ok) doc = await r.json();
  } catch { /* offline */ }
  if (!doc) doc = fallback !== undefined ? fallback : envelope(path);
  cache.set(path, doc);
  return doc;
}
export const exists = async (path) => {
  try { const r = await fetch(`data/${path}.json?t=${Date.now()}`, { method: 'HEAD', cache: 'no-store' }); return r.ok; } catch { return false; }
};

export async function save(path, doc) {
  if (!canWrite()) throw new ReadOnlyError();
  doc.updatedAt = nowISO();
  const r = await fetch(`api/data/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc, null, 2) + '\n',
  });
  if (!r.ok) {
    let msg = `Falha ao salvar ${path}`;
    try { msg = (await r.json()).error || msg; } catch { }
    throw new Error(msg);
  }
  cache.set(path, doc);
  emit(path);
  return doc;
}

export async function items(path) { return (await load(path)).items || []; }

export async function upsert(path, item) {
  const doc = await load(path);
  doc.items = doc.items || [];
  const now = nowISO();
  const i = doc.items.findIndex((x) => x.id === item.id);
  if (i >= 0) doc.items[i] = { ...doc.items[i], ...item, updatedAt: now };
  else doc.items.push({ createdAt: now, ...item, updatedAt: now });
  await save(path, doc);
  return item;
}

export async function upsertMany(path, list) {
  const doc = await load(path);
  doc.items = doc.items || [];
  const now = nowISO();
  for (const item of list) {
    const i = doc.items.findIndex((x) => x.id === item.id);
    if (i >= 0) doc.items[i] = { ...doc.items[i], ...item, updatedAt: now };
    else doc.items.push({ createdAt: now, ...item, updatedAt: now });
  }
  await save(path, doc);
}

export async function remove(path, id) {
  const doc = await load(path);
  doc.items = (doc.items || []).filter((x) => x.id !== id);
  await save(path, doc);
}

export function invalidate(path) { path ? cache.delete(path) : cache.clear(); }

/** Exporta tudo num único JSON (útil para migração ou backup manual). */
export async function exportBundle() {
  const meta = await load('_meta', {});
  const paths = ['settings', 'routine/blocks', 'focus/modes', 'focus/cycles', 'ai/suggestions', 'finance/accounts', 'finance/snapshots', 'finance/goals', 'vault/vault.enc'];
  const out = { exportedAt: nowISO(), app: 'PlanLife', schemaVersion: meta.schemaVersion || 1, files: {} };
  for (const p of paths) out.files[p] = await load(p, null);
  // logs mensais dos últimos 24 meses
  const d = new Date();
  for (let i = 0; i < 24; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const p = `routine/logs/${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    if (await exists(p)) out.files[p] = await load(p);
  }
  return out;
}
