// Camada de dados. Cada coleção é um arquivo JSON em /data com o mesmo envelope:
// { schema, version, updatedAt, items: [...] }  (settings.json usa campos em vez de items)
//
// Onde os arquivos são lidos e gravados:
//   local   → servidor do PC (serve.ps1), grava na pasta data/
//   github  → API do GitHub com o token guardado no cofre: cada gravação vira um commit
//   readonly→ só leitura (GitHub Pages antes do login, ou sem token)
//
// Criptografia: quando existe cofre, todos os arquivos (menos o próprio cofre e _meta)
// são gravados cifrados com a chave da sessão (AES-256-GCM, AAD = caminho do arquivo).

import { nowISO } from './util.js';
import { encryptJSON, decryptJSON } from './crypto.js';

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
export const PLAIN_PATHS = new Set(['vault/vault.enc', '_meta']);
export const KNOWN_PATHS = ['settings', 'routine/blocks', 'focus/modes', 'focus/cycles', 'ai/suggestions', 'finance/accounts', 'finance/snapshots', 'finance/goals'];
const ENC_SCHEMA = 'planlife.enc';

const cache = new Map();
const shas = new Map();      // sha de cada arquivo no GitHub (necessário para atualizar)
const plainSeen = new Set(); // arquivos ainda sem criptografia (migração)
const listeners = new Set();
let localServer = false;
let vaultExists = false;
let key = null;
let gh = null;               // { owner, repo, branch, token }

export class ReadOnlyError extends Error {
  constructor() { super('Somente leitura. Entre com a Chave Mestra e configure o GitHub em Ajustes para salvar pela web, ou use o start.cmd no PC.'); }
}
export class LockedError extends Error {
  constructor() { super('Dados protegidos. Entre com a Chave Mestra.'); }
}

export async function init() {
  try {
    const r = await fetch('api/health', { cache: 'no-store' });
    const j = r.ok ? await r.json() : null;
    localServer = !!(j && j.ok);
  } catch { localServer = false; }
  vaultExists = await existsStatic('vault/vault.enc');
  return getMode();
}
export const getMode = () => localServer ? 'local' : gh && key ? 'github' : 'readonly';
export const canWrite = () => getMode() !== 'readonly';
export const isEncrypted = () => vaultExists;
export const needsLogin = () => vaultExists && !key;
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (path) => listeners.forEach((fn) => fn(path));

/** Chamado pela sessão ao entrar/sair. */
export function setSession(k, github) {
  key = k; gh = github && github.token ? github : null;
  if (k) vaultExists = true;
  cache.clear(); shas.clear();
}
export const markVaultCreated = () => { vaultExists = true; };
export const githubInfo = () => gh ? { owner: gh.owner, repo: gh.repo, branch: gh.branch } : null;

function schemaFor(path) {
  const k = Object.keys(SCHEMAS).find((x) => path === x || path.startsWith(x + '/'));
  return SCHEMAS[k] || `planlife.${path.replace(/\//g, '.')}`;
}
export const envelope = (path, items = []) => ({ schema: schemaFor(path), version: 1, updatedAt: nowISO(), items });

/* ---------------- Transporte ---------------- */
const b64encode = (str) => { const b = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));
const ghUrl = (path) => `https://api.github.com/repos/${encodeURIComponent(gh.owner)}/${encodeURIComponent(gh.repo)}/contents/data/${path}.json`;
const ghHeaders = () => ({ authorization: `Bearer ${gh.token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' });

async function ghGet(path) {
  const r = await fetch(`${ghUrl(path)}?ref=${encodeURIComponent(gh.branch || 'main')}&t=${Date.now()}`, { headers: ghHeaders(), cache: 'no-store' });
  if (r.status === 404) { shas.delete(path); return null; }
  if (r.status === 401) throw new Error('Token do GitHub inválido ou expirado. Atualize em Ajustes.');
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status} ao ler ${path}.`);
  const j = await r.json();
  shas.set(path, j.sha);
  if (j.content) return JSON.parse(b64decode(j.content));
  // arquivos > 1 MB vêm sem conteúdo: busca pelo download_url
  const raw = await fetch(j.download_url, { headers: { authorization: `Bearer ${gh.token}` } });
  return raw.json();
}

async function ghPut(path, text, retry = true) {
  if (!shas.has(path)) { try { await ghGet(path); } catch { } }
  const body = { message: `PlanLife: atualiza ${path}`, content: b64encode(text), branch: gh.branch || 'main' };
  if (shas.get(path)) body.sha = shas.get(path);
  const r = await fetch(ghUrl(path), { method: 'PUT', headers: { ...ghHeaders(), 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if ((r.status === 409 || r.status === 422) && retry) { shas.delete(path); await ghGet(path).catch(() => { }); return ghPut(path, text, false); }
  if (r.status === 401 || r.status === 403) throw new Error('O token do GitHub não tem permissão de escrita neste repositório.');
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status} ao salvar ${path}.`);
  const j = await r.json();
  shas.set(path, j.content?.sha);
}

async function staticGet(path) {
  const r = await fetch(`data/${path}.json?t=${Date.now()}`, { cache: 'no-store' });
  return r.ok ? r.json() : null;
}
async function existsStatic(path) {
  try { const r = await fetch(`data/${path}.json?t=${Date.now()}`, { cache: 'no-store' }); return r.ok; } catch { return false; }
}

/* ---------------- Leitura e gravação ---------------- */
async function decode(path, doc) {
  if (!doc || doc.schema !== ENC_SCHEMA) {
    if (doc && vaultExists && !PLAIN_PATHS.has(path)) plainSeen.add(path);
    return doc;
  }
  if (!key) throw new LockedError();
  return decryptJSON(key, doc.iv, doc.data, `planlife:${path}`);
}

/** Lê data/<path>.json. Se não existir, devolve um envelope vazio (ou `fallback`). */
export async function load(path, fallback) {
  if (cache.has(path)) return cache.get(path);
  let doc = null;
  try {
    doc = !localServer && gh && key ? await ghGet(path) : await staticGet(path);
  } catch (e) { if (gh && key) throw e; }
  doc = await decode(path, doc);
  if (!doc) doc = fallback !== undefined ? fallback : envelope(path);
  cache.set(path, doc);
  return doc;
}

export async function exists(path) {
  if (cache.has(path) && cache.get(path)) return true;
  if (!localServer && gh && key) { try { return !!(await ghGet(path)); } catch { return false; } }
  return existsStatic(path);
}

export async function save(path, doc) {
  if (!canWrite()) throw new ReadOnlyError();
  doc.updatedAt = nowISO();
  let out = doc;
  if (vaultExists && !PLAIN_PATHS.has(path)) {
    if (!key) throw new LockedError();
    const { iv, data } = await encryptJSON(key, doc, `planlife:${path}`);
    out = { schema: ENC_SCHEMA, version: 1, path, cipher: 'AES-256-GCM', iv, data, updatedAt: doc.updatedAt };
  }
  const text = JSON.stringify(out, null, 2) + '\n';
  if (localServer) {
    const r = await fetch(`api/data/${path}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: text });
    if (!r.ok) {
      let msg = `Falha ao salvar ${path}`;
      try { msg = (await r.json()).error || msg; } catch { }
      throw new Error(msg);
    }
  } else {
    await ghPut(path, text);
  }
  plainSeen.delete(path);
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

function recentLogPaths(months = 24) {
  const d = new Date(); const out = [];
  for (let i = 0; i < months; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`routine/logs/${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/** Cifra os arquivos que ainda estão em texto puro. Devolve quantos foram cifrados. */
export async function encryptPlainFiles() {
  if (!key || !canWrite()) return 0;
  let n = 0;
  for (const p of [...KNOWN_PATHS, ...recentLogPaths(24)]) {
    let doc;
    try { cache.delete(p); doc = await load(p, null); } catch { continue; }
    if (doc && plainSeen.has(p)) { await save(p, doc); n++; }
  }
  return n;
}

/** Exporta tudo decifrado num único JSON (útil para migração ou backup manual). */
export async function exportBundle() {
  const meta = await load('_meta', {});
  const out = { exportedAt: nowISO(), app: 'PlanLife', schemaVersion: meta.schemaVersion || 1, note: 'Arquivo decifrado: guarde em local seguro.', files: {} };
  for (const p of [...KNOWN_PATHS, 'vault/vault.enc']) out.files[p] = await load(p, null);
  for (const p of recentLogPaths(24)) if (await exists(p)) out.files[p] = await load(p);
  return out;
}
