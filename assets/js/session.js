// Sessão única do PlanLife. O login é a Chave Mestra + 2FA do cofre:
// a mesma chave AES que abre o cofre cifra todos os arquivos de dados.
// A chave vive só na memória desta aba; recarregar a página pede login de novo.

import * as store from './store.js';
import * as C from './crypto.js';
import { nowISO, toast } from './util.js';

export const PATH = 'vault/vault.enc';
export const AAD = 'planlife-vault-v1';
const IDLE_MS = 15 * 60 * 1000;

export const session = { key: null, data: null, file: null };
let idleTimer = null;
let lastTouch = 0;

export const isOpen = () => !!session.key;

export function touch() {
  if (!session.key) return;
  const now = Date.now();
  if (now - lastTouch < 5000) return; // no máximo a cada 5 s
  lastTouch = now;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { lock(); toast('Sessão encerrada por inatividade.'); setTimeout(() => location.reload(), 800); }, IDLE_MS);
}
['pointerdown', 'keydown', 'wheel'].forEach((ev) => addEventListener(ev, touch, { passive: true }));

export function lock() {
  session.key = null; session.data = null; session.file = null;
  clearTimeout(idleTimer);
  store.setSession(null, null);
}

/** Abre a sessão depois da Chave Mestra e do 2FA já verificados. */
export function open(key, data, file) {
  session.key = key; session.data = data; session.file = file;
  data.integrations = data.integrations || {};
  store.setSession(key, data.integrations.github || null);
  lastTouch = 0; touch();
}

/** Grava o cofre (entradas, 2FA e integrações) cifrado. */
export async function persist() {
  const { iv, data } = await C.encryptJSON(session.key, session.data, AAD);
  const file = { ...session.file, cipher: { ...session.file.cipher, iv }, data, updatedAt: nowISO(), entries: session.data.entries.length };
  await store.save(PATH, file);
  session.file = file;
}

/** Atualiza a integração com o GitHub dentro do cofre e reconfigura o armazenamento. */
export async function setGitHub(cfg) {
  session.data.integrations = session.data.integrations || {};
  if (cfg) session.data.integrations.github = cfg; else delete session.data.integrations.github;
  store.setSession(session.key, cfg || null);
  await persist();
}

export async function setAIKey(provider, key) {
  session.data.integrations = session.data.integrations || {};
  const ai = session.data.integrations.ai = session.data.integrations.ai || {};
  if (key) ai[provider] = key; else delete ai[provider];
  await persist();
}
export const getAIKey = (provider) => session.data?.integrations?.ai?.[provider] || '';
