// Utilitários: DOM, datas, formatação, ícones, toasts.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Cria elementos: h('div', {class:'x', onclick}, 'texto', h('span')) */
export function h(tag, props, ...children) {
  const el = tag === 'svg' || tag === 'path' || tag === 'line' || tag === 'polyline' || tag === 'rect' || tag === 'circle' || tag === 'g' || tag === 'text'
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'value' && 'value' in el) el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
      else if (k.startsWith('--')) el.style.setProperty(k, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

export const uid = (p = '') => p + crypto.randomUUID().slice(0, 13).replace(/-/g, '');
export const nowISO = () => new Date().toISOString();

/* ---------- Datas (sempre no fuso local) ---------- */
export const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const isoWeekday = (d) => ((d.getDay() + 6) % 7) + 1; // 1 = seg ... 7 = dom
export const startOfWeek = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), 1 - isoWeekday(d));
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}
export const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 86400000);
export const toMin = (hhmm) => { if (!hhmm) return null; const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const toHHMM = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
export const fmtDur = (min) => {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h${pad(m)}` : `${h}h`) : `${m} min`;
};

const LOCALE = 'pt-BR';
export const WEEKDAYS_SHORT = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
export const WEEKDAYS_LONG = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
export const fmtDate = (d, opts) => new Intl.DateTimeFormat(LOCALE, opts).format(d);
export const fmtDayLong = (d) => {
  const s = fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const fmtShort = (d) => fmtDate(d, { day: '2-digit', month: 'short' }).replace('.', '');
export const fmtMonth = (d) => { const s = fmtDate(d, { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };

const brl = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL' });
const brlCompact = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
export const money = (n) => brl.format(Number(n) || 0);
export const moneyCompact = (n) => brlCompact.format(Number(n) || 0);
export const pct = (n) => `${Math.round((Number(n) || 0) * 100)}%`;
export const parseMoney = (s) => {
  if (typeof s === 'number') return s;
  const t = String(s || '').replace(/[^\d,.-]/g, '');
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
  return Number(t) || 0;
};

/* ---------- Ícones (traço único 1.75, desenhados em 24x24) ---------- */
const P = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  routine: '<path d="M4 6h16M4 12h10M4 18h7"/><path d="M17 15l2 2 3-4"/>',
  cycles: '<path d="M3 17h4l3-9 4 12 3-7h4"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  finance: '<path d="M3 20h18"/><path d="M6 16V11M11 16V7M16 16v-6M21 16V4"/>',
  vault: '<rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/><path d="M12 14.5v2"/>',
  assistant: '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10.5h.01M12 10.5h.01M15 10.5h.01"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17.6 17.6 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  lock: '<rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.2-2.4 3.8M12 17h.01"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M4 4h16"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
};
export function icon(name, size = 18) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.75'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'icon');
  s.innerHTML = P[name] || '';
  return s;
}

/* ---------- Toasts ---------- */
export function toast(msg, kind = 'info', ms = 3200) {
  let host = $('#toasts');
  if (!host) { host = h('div', { id: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(host); }
  const t = h('div', { class: `toast toast--${kind}` }, msg);
  host.append(t);
  setTimeout(() => { t.classList.add('is-leaving'); setTimeout(() => t.remove(), 300); }, ms);
}

export async function copyText(text, label = 'Copiado', clearAfter = 0) {
  try {
    await navigator.clipboard.writeText(text);
    toast(clearAfter ? `${label}. A área de transferência será limpa em ${clearAfter}s.` : label, 'ok');
    if (clearAfter) setTimeout(async () => {
      try { if ((await navigator.clipboard.readText()) === text) await navigator.clipboard.writeText(''); } catch { /* sem permissão de leitura */ }
    }, clearAfter * 1000);
  } catch { toast('Não foi possível copiar.', 'error'); }
}

export function download(filename, text, type = 'application/json') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: filename });
  document.body.append(a); a.click(); a.remove();
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
