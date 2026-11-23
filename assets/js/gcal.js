// Google Agenda via Google Identity Services (OAuth 100% no navegador).
// Funciona em http://localhost:3100 e no GitHub Pages, desde que as duas origens
// estejam cadastradas no Client ID (veja o README).

import { getSettings } from './planning.js';
import { dateKey, pad } from './util.js';

const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly';
const TOKEN_KEY = 'planlife.gcal.token';
let tokenClient = null;
let gisLoading = null;

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!gisLoading) gisLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = resolve; s.onerror = () => reject(new Error('Não foi possível carregar o login do Google.'));
    document.head.append(s);
  });
  return gisLoading;
}

function readToken() {
  try {
    const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null');
    return t && t.expiresAt > Date.now() + 60000 ? t : null;
  } catch { return null; }
}
export const isConnected = () => !!readToken();
export function disconnect() {
  const t = readToken();
  sessionStorage.removeItem(TOKEN_KEY);
  if (t && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t.accessToken, () => { });
}

export async function connect() {
  const s = await getSettings();
  const clientId = s.google?.clientId;
  if (!clientId) throw new Error('Cadastre o Client ID do Google em Ajustes.');
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        const t = { accessToken: resp.access_token, expiresAt: Date.now() + (resp.expires_in || 3600) * 1000 };
        sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t));
        resolve(t);
      },
      error_callback: (err) => reject(new Error(err?.message || 'Login cancelado.')),
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

async function api(path, opts = {}) {
  const t = readToken();
  if (!t) throw new Error('Conecte o Google Agenda.');
  const r = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    ...opts, headers: { authorization: `Bearer ${t.accessToken}`, 'content-type': 'application/json', ...(opts.headers || {}) },
  });
  if (r.status === 401) { sessionStorage.removeItem(TOKEN_KEY); throw new Error('Sessão do Google expirou. Conecte de novo.'); }
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || `Erro ${r.status}`);
  return j;
}

export async function listCalendars() {
  const j = await api('users/me/calendarList?minAccessRole=reader');
  return (j.items || []).map((c) => ({ id: c.id, name: c.summaryOverride || c.summary, color: c.backgroundColor, primary: !!c.primary }));
}

/** Eventos entre duas datas (Date), normalizados. */
export async function listEvents(from, to) {
  if (!isConnected()) return [];
  const s = await getSettings();
  const ids = s.google?.calendarIds?.length ? s.google.calendarIds : ['primary'];
  const all = [];
  for (const id of ids) {
    const q = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
    try {
      const j = await api(`calendars/${encodeURIComponent(id)}/events?${q}`);
      for (const e of j.items || []) {
        if (e.status === 'cancelled') continue;
        const allDay = !!e.start?.date;
        const st = allDay ? new Date(e.start.date + 'T00:00') : new Date(e.start.dateTime);
        const en = allDay ? new Date(e.end.date + 'T00:00') : new Date(e.end.dateTime);
        all.push({
          id: `${id}:${e.id}`, title: e.summary || '(sem título)', calendarId: id, allDay, link: e.htmlLink,
          dateKey: dateKey(st), startMin: st.getHours() * 60 + st.getMinutes(),
          endMin: dateKey(en) === dateKey(st) ? en.getHours() * 60 + en.getMinutes() : 24 * 60,
          start: st, end: en,
        });
      }
    } catch (e) { console.warn('Agenda', id, e); }
  }
  return all;
}

export async function createEvent({ title, detail, date, start, durationMin }) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = start.split(':').map(Number);
  const st = new Date(y, m - 1, d, hh, mm);
  const en = new Date(st.getTime() + durationMin * 60000);
  const iso = (x) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}:00`;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return api('calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify({ summary: title, description: `${detail || ''}\n\nCriado pelo PlanLife`, start: { dateTime: iso(st), timeZone: tz }, end: { dateTime: iso(en), timeZone: tz } }),
  });
}
