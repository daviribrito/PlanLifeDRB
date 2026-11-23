// Importação de senhas para o cofre. Tudo acontece no navegador: o arquivo nunca é enviado.
// Formatos reconhecidos: Bitwarden (JSON), listas JSON genéricas (array ou objeto com array),
// objetos-mapa { "Gmail": { ... } } e CSV de navegadores (Chrome, Edge, Firefox) ou gerenciadores.

import { base32Decode } from './crypto.js';

const ALIASES = {
  title: ['site_name', 'sitename', 'service_name', 'name', 'title', 'nome', 'titulo', 'service', 'servico', 'account', 'conta', 'label', 'app', 'aplicativo', 'item', 'entry'],
  username: ['username', 'user', 'login', 'email', 'e-mail', 'usuario', 'user_name', 'userid', 'loginname'],
  password: ['password', 'senha', 'pass', 'pwd', 'passwd', 'passphrase', 'chave'],
  url: ['site_url', 'url', 'uri', 'website', 'site', 'link', 'origin_url', 'href', 'domain', 'dominio', 'login_uri'],
  totp: ['totp', 'otp', '2fa', 'mfa', 'authenticator', 'otpauth', 'one_time_password', 'two_factor'],
  notes: ['notes', 'note', 'notas', 'nota', 'observacao', 'observacoes', 'obs', 'comment', 'comments', 'extra', 'descricao', 'description'],
  updated: ['password_updated_at', 'updated_at', 'updatedat', 'modified', 'modified_at', 'last_modified', 'revisiondate', 'timepasswordchanged'],
  created: ['created_at', 'createdat', 'creationdate', 'timecreated'],
  folder: ['folder', 'pasta', 'category', 'categoria', 'group', 'grupo', 'grouping', 'collection', 'tag', 'tags', 'type', 'tipo', 'vault'],
};

const norm = (k) => String(k).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s-]+/g, '_');
const str = (v) => (v === null || v === undefined ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? '' : String(v)).trim();

function pick(obj, field) {
  const keys = Object.keys(obj);
  for (const alias of ALIASES[field]) {
    const k = keys.find((x) => norm(x) === norm(alias));
    if (k !== undefined) {
      const v = obj[k];
      if (field === 'url' && Array.isArray(v)) return str(v[0]?.uri ?? v[0]?.url ?? v[0]);
      if (str(v)) return str(v);
    }
  }
  return '';
}

/** Aceita a chave em Base32 ou uma URI otpauth://; devolve a chave ou ''. */
export function cleanTotp(v) {
  if (!v) return '';
  let s = String(v).trim();
  if (/^otpauth:\/\//i.test(s)) { try { s = new URL(s).searchParams.get('secret') || ''; } catch { return ''; } }
  s = s.replace(/[\s-]/g, '').toUpperCase();
  try { base32Decode(s); return s; } catch { return ''; }
}

const toISO = (v) => {
  if (!v) return '';
  const d = /^\d{10,13}$/.test(v) ? new Date(Number(v) * (v.length === 10 ? 1000 : 1)) : new Date(v);
  return isNaN(d) ? '' : d.toISOString();
};
const hostOf = (u) => { try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, ''); } catch { return ''; } };

function fromGeneric(obj, folderHint = '') {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  // muitos formatos aninham as credenciais em "login"/"credentials"/"fields"
  const nested = obj.login && typeof obj.login === 'object' ? obj.login : obj.credentials && typeof obj.credentials === 'object' ? obj.credentials : null;
  const src = nested ? { ...obj, ...nested } : obj;
  const url = pick(src, 'url');
  const e = {
    title: pick(src, 'title'),
    username: pick(src, 'username'),
    password: pick(src, 'password'),
    url,
    totp: cleanTotp(pick(src, 'totp')),
    notes: pick(src, 'notes'),
    folder: pick(src, 'folder') || folderHint,
    updatedAt: toISO(pick(src, 'updated')),
    createdAt: toISO(pick(src, 'created')),
  };
  if (!e.title) e.title = hostOf(url) || e.username || '';
  if (!e.password && !e.notes) return null;
  if (!e.title) e.title = 'Sem nome';
  return e;
}

function fromBitwarden(doc) {
  const folders = Object.fromEntries((doc.folders || []).map((f) => [f.id, f.name]));
  const out = [];
  for (const it of doc.items || []) {
    if (it.type !== 1 && it.type !== 2) continue; // 1 = login, 2 = nota segura
    const l = it.login || {};
    const extra = (it.fields || []).filter((f) => f.name && f.value).map((f) => `${f.name}: ${f.value}`).join('\n');
    const e = {
      title: it.name || hostOf(l.uris?.[0]?.uri || '') || 'Sem nome',
      username: l.username || '',
      password: l.password || '',
      url: l.uris?.[0]?.uri || '',
      totp: cleanTotp(l.totp),
      notes: [it.notes, extra].filter(Boolean).join('\n\n'),
      folder: folders[it.folderId] || '',
    };
    if (e.password || e.notes) out.push(e);
  }
  return out;
}

/** CSV simples com aspas, vírgula ou ponto e vírgula. */
function parseCSV(text) {
  const first = text.split(/\r?\n/, 1)[0];
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((k, i) => [k.trim(), r[i] ?? ''])));
}

function findArray(doc, depth = 0) {
  if (Array.isArray(doc)) return doc;
  if (!doc || typeof doc !== 'object' || depth > 3) return null;
  let best = null;
  for (const v of Object.values(doc)) {
    const a = findArray(v, depth + 1);
    if (a && a.some((x) => x && typeof x === 'object') && (!best || a.length > best.length)) best = a;
  }
  return best;
}

/** Lê o conteúdo do arquivo e devolve { format, entries, skipped }. */
export function parseImport(text, filename = '') {
  const t = text.replace(/^﻿/, '').trim();
  if (!t) throw new Error('O arquivo está vazio.');
  if (/\.csv$/i.test(filename) || (!/^[[{]/.test(t))) {
    const rows = parseCSV(t);
    const entries = rows.map((r) => fromGeneric(r)).filter(Boolean);
    return { format: 'CSV', entries, skipped: rows.length - entries.length };
  }
  let doc;
  try { doc = JSON.parse(t); } catch { throw new Error('Não é um JSON válido. Confira se o arquivo não está corrompido.'); }
  if (doc && doc.encrypted === true) throw new Error('Este arquivo do Bitwarden está protegido por senha. Exporte de novo no formato “.json” sem criptografia.');
  if (doc && Array.isArray(doc.items) && doc.items.some((x) => 'login' in x || 'type' in x) && ('folders' in doc || doc.items.some((x) => typeof x.type === 'number'))) {
    const entries = fromBitwarden(doc);
    return { format: 'Bitwarden', entries, skipped: doc.items.length - entries.length };
  }
  const arr = findArray(doc);
  if (arr) {
    const entries = arr.map((x) => fromGeneric(x)).filter(Boolean);
    return { format: 'JSON (lista)', entries, skipped: arr.length - entries.length };
  }
  // objeto-mapa: { "Gmail": { username, password }, "Banco": { ... } } ou { "Pasta": { "Gmail": {...} } }
  if (doc && typeof doc === 'object') {
    const entries = []; let total = 0;
    for (const [k, v] of Object.entries(doc)) {
      if (!v || typeof v !== 'object') continue;
      const direct = fromGeneric({ name: k, ...v });
      if (direct && (pick(v, 'password') || pick(v, 'notes'))) { entries.push(direct); total++; continue; }
      for (const [k2, v2] of Object.entries(v)) {
        if (!v2 || typeof v2 !== 'object') continue;
        total++;
        const e = fromGeneric({ name: k2, ...v2 }, k);
        if (e) entries.push(e);
      }
    }
    if (entries.length) return { format: 'JSON (objeto)', entries, skipped: total - entries.length };
  }
  throw new Error('Não encontrei senhas neste arquivo. Os campos esperados são algo como nome, usuário, senha e site.');
}

/** Chave para detectar duplicados: nome + usuário (+ site), sem diferenciar maiúsculas. */
export const dupKey = (e) => [e.title, e.username, hostOf(e.url || '')].map((x) => String(x || '').trim().toLowerCase()).join('|');
