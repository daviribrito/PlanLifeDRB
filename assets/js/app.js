// Shell do PlanLife: navegação por hash (funciona no GitHub Pages), trilho tingido pelo ciclo atual.

import * as store from './store.js';
import { h, icon, clear, $, dateKey } from './util.js';
import { cyclesOn, cycleProgress, modesById } from './planning.js';
import * as gcal from './gcal.js';

const ROUTES = [
  { path: 'hoje', label: 'Hoje', icon: 'today', load: () => import('./views/today.js') },
  { path: 'rotina', label: 'Rotina', icon: 'routine', load: () => import('./views/routine.js') },
  { path: 'ciclos', label: 'Ciclos de foco', icon: 'cycles', load: () => import('./views/cycles.js') },
  { path: 'agenda', label: 'Agenda', icon: 'calendar', load: () => import('./views/calendar.js') },
  { path: 'financas', label: 'Finanças', icon: 'finance', load: () => import('./views/finance.js') },
  { path: 'cofre', label: 'Cofre', icon: 'vault', load: () => import('./views/vault.js') },
  { path: 'assistente', label: 'Assistente', icon: 'assistant', load: () => import('./views/assistant.js') },
  { path: 'ajustes', label: 'Ajustes', icon: 'settings', load: () => import('./views/settings.js') },
];

let renderSeq = 0;
let firstRender = true;
let teardown = null;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '') || 'hoje';
  const [path, qs] = raw.split('?');
  return { path, params: new URLSearchParams(qs || '') };
}

function setHeader({ title, line = [], actions = [] }) {
  const top = $('#topbar');
  clear(top).append(
    h('div', { class: 'guide' }, h('h1', null, title), line.length ? h('div', { class: 'guide-line' }, line.filter(Boolean).map((x) => typeof x === 'string' ? h('span', null, x) : x)) : null),
    h('div', { class: 'topbar-actions' }, actions.filter(Boolean)),
  );
  document.title = `${title} · PlanLife`;
}

async function renderNav(current) {
  const sugg = await store.items('ai/suggestions');
  const pending = sugg.filter((s) => s.status === 'pending').length;
  const nav = $('#nav');
  clear(nav).append(...ROUTES.map((r) => h('a', { href: `#/${r.path}`, 'aria-current': r.path === current ? 'page' : null, 'data-label': r.label, 'aria-label': r.label },
    icon(r.icon, 20), h('span', { class: 'nav-label' }, r.label),
    r.path === 'assistente' && pending ? h('b', { class: 'nav-count', 'aria-label': `${pending} pendentes` }, pending) : null)));
}

// Ampliação por proximidade na ilha (mecânica do Dock Nav da 21st, sem React):
// o item sob o ponteiro cresce mais, os vizinhos um pouco menos.
function initDockMagnify() {
  const nav = $('#nav');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const SCALE = [1.24, 1.1, 1.04];
  const apply = (idx) => [...nav.children].forEach((a, i) => {
    const d = idx === null ? 99 : Math.abs(i - idx);
    a.style.setProperty('--s', SCALE[d] ?? 1);
  });
  nav.addEventListener('pointerover', (e) => {
    const a = e.target.closest('a'); if (!a || e.pointerType === 'touch') return;
    apply([...nav.children].indexOf(a));
  });
  nav.addEventListener('pointerleave', () => apply(null));
}

/** Anel de progresso do ciclo (desenhado, 26px). */
function ring(frac, color) {
  const r = 10, c = 2 * Math.PI * r;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 26 26'); s.setAttribute('class', 'dock-ring'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<circle cx="13" cy="13" r="${r}" fill="none" stroke="color-mix(in oklab, ${color} 22%, transparent)" stroke-width="3.5"/>
    <circle cx="13" cy="13" r="${r}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"
      stroke-dasharray="${(c * frac).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 13 13)"/>`;
  return s;
}

async function renderRail() {
  const [cycles, modes] = await Promise.all([store.items('focus/cycles'), modesById()]);
  const today = dateKey();
  const top = cyclesOn(today, cycles)[0];
  const m = top && modes[top.modeId];
  document.documentElement.style.setProperty('--mode', m?.color || '#475569');
  const theme = (() => { try { return localStorage.getItem('planlife.theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } })();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const themeLabel = theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro';
  let cycleCard;
  if (m) {
    const p = cycleProgress(top, today);
    cycleCard = h('a', { class: 'dock-cycle', href: '#/ciclos', 'aria-label': `Ciclo atual: ${m.name}, dia ${p.idx} de ${p.total}`, title: top.goal || m.name },
      ring(p.idx / p.total, m.color),
      h('span', { class: 'dock-cycle-text' }, h('b', null, m.name), h('small', null, `dia ${p.idx} de ${p.total}`)));
  } else {
    cycleCard = h('a', { class: 'dock-cycle', href: '#/ciclos' }, ring(0, '#475569'),
      h('span', { class: 'dock-cycle-text' }, h('b', null, 'Sem ciclo hoje'), h('small', null, 'escolher um foco')));
  }
  clear($('#dock-cycle')).append(cycleCard);
  clear($('#dock-tools')).append(
    h('button', {
      class: 'dock-btn', 'aria-label': themeLabel, title: themeLabel, onclick: () => {
        try { localStorage.setItem('planlife.theme', nextTheme); } catch { }
        document.documentElement.dataset.theme = nextTheme;
        renderRail();
      },
    }, icon(theme === 'dark' ? 'sun' : 'moon', 19)),
    (() => {
      const mode = store.getMode();
      const label = mode === 'local' ? 'Local · salvando na pasta data/' : mode === 'github' ? `Web · salvando no GitHub (${store.githubInfo()?.repo})` : 'Somente leitura';
      return h('span', { class: 'dock-status', 'data-mode': mode === 'readonly' ? 'readonly' : 'local', role: 'img', 'aria-label': label, title: label });
    })(),
  );
}

// Eventos do Google em cache curto, compartilhado entre telas
const evCache = new Map();
async function getEvents(from, to) {
  if (!gcal.isConnected()) return [];
  const k = `${from.toISOString()}|${to.toISOString()}`;
  const hit = evCache.get(k);
  if (hit && Date.now() - hit.t < 120000) return hit.v;
  try {
    const v = await gcal.listEvents(from, to);
    evCache.set(k, { t: Date.now(), v });
    return v;
  } catch (e) { console.warn(e); return []; }
}

async function render() {
  const seq = ++renderSeq;
  const { path, params } = parseHash();
  const route = ROUTES.find((r) => r.path === path) || ROUTES[0];
  teardown?.(); teardown = null;
  const view = $('#view');

  // Portão de login: com cofre criado, nada é lido antes da Chave Mestra + 2FA.
  if (store.needsLogin()) {
    document.body.classList.add('is-locked');
    document.documentElement.style.setProperty('--mode', '#2563EB');
    clear(view); view.classList.remove('is-entering');
    const { renderLogin } = await import('./views/vault.js');
    setHeader({ title: 'Entrar', line: [] });
    await renderLogin(view, { params, header: () => {}, go: (hash) => { location.hash = hash; }, refresh: () => render(), onLeave: (fn) => { teardown = fn; }, first: true, gate: true });
    return;
  }
  document.body.classList.remove('is-locked');

  await Promise.all([renderNav(route.path), renderRail()]);
  const mod = await route.load();
  if (seq !== renderSeq) return;
  clear(view);
  view.classList.remove('is-entering');
  void view.offsetWidth; view.classList.add('is-entering');
  const ctx = {
    params, header: setHeader, first: firstRender,
    go: (hash) => { location.hash = hash; },
    refresh: () => render(),
    events: getEvents, clearEvents: () => evCache.clear(),
    onLeave: (fn) => { teardown = fn; },
    refreshChrome: () => Promise.all([renderNav(route.path), renderRail()]),
  };
  try {
    await mod.default(view, ctx);
  } catch (e) {
    console.error(e);
    view.append(h('div', { class: 'panel' }, h('div', { class: 'empty' }, h('h3', null, 'Não foi possível abrir esta tela'), h('p', null, e.message))));
  }
  firstRender = false;
  if (seq === renderSeq && document.activeElement === document.body) view.focus({ preventScroll: true });
}

store.onChange((p) => {
  if (p === 'focus/cycles' || p === 'focus/modes') renderRail();
  if (p === 'ai/suggestions') renderNav(parseHash().path);
});

window.addEventListener('hashchange', render);
await store.init();
initDockMagnify();
render();
