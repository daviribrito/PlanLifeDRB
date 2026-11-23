// Componentes compartilhados: gaveta, faixa de periodização, linha do tempo, chips.

import { h, icon, clear, toast, dateKey, fromKey, addDays, startOfWeek, isoWeek, isoWeekday, WEEKDAYS_SHORT, toHHMM, toMin, fmtDur, fmtShort } from './util.js';
import { cyclesOn, layoutColumns, freeWindows, KIND_LABEL } from './planning.js';
import * as store from './store.js';

/** Executa uma gravação mostrando erros de forma clara. */
export async function guard(fn, okMsg) {
  try {
    const r = await fn();
    if (okMsg) toast(okMsg, 'ok');
    return r ?? true;
  } catch (e) {
    console.error(e);
    toast(e.message || 'Algo deu errado.', 'error', 5000);
    return false;
  }
}

export const modeChip = (m, text) => m ? h('span', { class: 'chip', '--c': m.color }, text ?? m.name) : null;

/* ---------- Gaveta lateral (formulários sem bloquear o contexto) ---------- */
export function drawer({ title, body, actions = [], onClose }) {
  const prev = document.activeElement;
  const backdrop = h('div', { class: 'drawer-backdrop' });
  const close = () => {
    panel.classList.remove('is-open'); backdrop.classList.remove('is-open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { panel.remove(); backdrop.remove(); prev?.focus?.(); }, 300);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const panel = h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'drawer-head' }, h('h2', null, title), h('button', { class: 'iconbtn', 'aria-label': 'Fechar', onclick: close }, icon('x'))),
    h('div', { class: 'drawer-body' }, body),
    actions.length ? h('div', { class: 'drawer-foot' }, actions.map((a) => typeof a === 'function' ? a(close) : a)) : null,
  );
  backdrop.addEventListener('click', close);
  document.body.append(backdrop, panel);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => {
    panel.classList.add('is-open'); backdrop.classList.add('is-open');
    panel.querySelector('input, select, textarea, button:not(.iconbtn)')?.focus();
  });
  return { close, panel };
}

export function field(label, control, hint) {
  const id = control.id || `f-${Math.random().toString(36).slice(2, 8)}`;
  control.id = id;
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, hint ? h('small', null, hint) : null);
}

export function weekdayPicker(selected = []) {
  const set = new Set(selected);
  const el = h('div', { class: 'days', role: 'group', 'aria-label': 'Dias da semana' },
    WEEKDAYS_SHORT.map((d, i) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(set.has(i + 1)) }, d);
      b.addEventListener('click', () => { set.has(i + 1) ? set.delete(i + 1) : set.add(i + 1); b.setAttribute('aria-pressed', String(set.has(i + 1))); });
      return b;
    }));
  el.value = () => [...set].sort();
  return el;
}

export const PALETTE = ['#E0452B', '#D2691E', '#A87F00', '#0E9F6E', '#0891B2', '#2563EB', '#4F46E5', '#7445D8', '#C026D3', '#DB2777', '#475569'];
export function swatchPicker(current) {
  let val = current || PALETTE[5];
  const el = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Cor' }, PALETTE.map((c) => {
    const b = h('button', { type: 'button', style: { background: c }, 'aria-label': c, 'aria-pressed': String(c === val) });
    b.addEventListener('click', () => { val = c; el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
    return b;
  }));
  el.value = () => val;
  return el;
}

/* ---------- Faixa de periodização (assinatura do produto) ----------
   Seis semanas de dias em três faixas: Mês, Semana, Dias. Clique num dia para abrir. */
export function periodStrip({ cycles, modes, from, weeks = 6, today = dateKey(), onDay, title = 'Periodização', actions, animate = false }) {
  const start = startOfWeek(from);
  const n = weeks * 7;
  const days = Array.from({ length: n }, (_, i) => addDays(start, i));
  const keys = days.map(dateKey);
  const grid = h('div', { class: 'strip-grid', '--n': n, role: 'grid', 'aria-label': 'Ciclos de foco por dia' });

  grid.append(h('div'));
  for (let w = 0; w < weeks; w++) {
    const d = days[w * 7];
    grid.append(h('div', { class: 'strip-week', style: { gridColumn: `span 7` } }, `S${isoWeek(d)} · ${fmtShort(d)}`));
  }

  let paintIdx = 0;
  for (const kind of ['month', 'week', 'custom']) {
    grid.append(h('div', { class: 'strip-label' }, KIND_LABEL[kind]));
    const perDay = keys.map((k) => cyclesOn(k, cycles).find((c) => c.kind === kind) || null);
    perDay.forEach((c, i) => {
      const m = c && modes[c.modeId];
      const prev = i > 0 && i % 7 !== 0 ? perDay[i - 1] : null;
      const next = i < n - 1 && (i + 1) % 7 !== 0 ? perDay[i + 1] : null;
      const runStart = c && (!prev || prev.id !== c.id);
      const runEnd = c && (!next || next.id !== c.id);
      const cell = h('div', {
        class: `strip-cell${i % 7 === 0 ? ' is-week-start' : ''}${runStart ? ' is-run-start' : ''}${runEnd ? ' is-run-end' : ''}`,
        'data-c': m ? '' : null, '--c': m?.color, '--i': m ? paintIdx++ : null,
        title: m ? `${m.name} (${KIND_LABEL[kind]})${c.goal ? ' — ' + c.goal : ''}` : null,
      });
      if (m && runStart) {
        let len = 1; while (perDay[i + len] && perDay[i + len].id === c.id && (i + len) % 7 !== 0) len++;
        if (len >= 2) cell.append(h('span', { class: 'strip-tag', style: { width: `calc(${len * 100}% - 8px)` } }, len >= 4 ? m.name : m.name.split(' ')[0]));
      }
      grid.append(cell);
    });
  }
  // linha de resumo: foco principal do dia, clicável
  grid.append(h('div', { class: 'strip-label' }, 'Foco'));
  keys.forEach((k, i) => {
    const top = cyclesOn(k, cycles)[0];
    const m = top && modes[top.modeId];
    const b = h('button', {
      class: `strip-sum${k === today ? ' is-today' : ''}`, 'data-c': m ? '' : null, '--c': m?.color,
      'aria-label': `${fmtShort(days[i])}${m ? ': ' + m.name : ': sem ciclo'}`, title: m ? m.name : 'Sem ciclo',
    }, days[i].getDate());
    b.addEventListener('click', () => onDay?.(k));
    grid.append(b);
  });

  const ti = keys.indexOf(today);
  if (ti >= 0) {
    const now = new Date();
    const frac = (now.getHours() * 60 + now.getMinutes()) / 1440;
    grid.append(h('div', { class: 'strip-now', style: { left: `calc(64px + (100% - 64px) * ${(ti + frac) / n})` } }));
  }

  const el = h('section', { class: `strip${animate ? ' is-entering' : ''}`, 'aria-label': title },
    h('div', { class: 'strip-head' }, h('h2', null, title), h('span', { class: 'muted', style: { fontSize: '13px' } }, `${fmtShort(days[0])} a ${fmtShort(days[n - 1])}`), actions ? h('div', { class: 'row' }, actions) : null),
    grid);
  return el;
}

/* ---------- Linha do tempo do dia (altura = duração real) ---------- */
export function timeline({ items, settings, dayKey: key, ppm = 1.05, onItem, showFree = true }) {
  const dayStart = toMin(settings.day?.start || '06:00');
  const dayEnd = toMin(settings.day?.end || '23:00');
  const s0 = Math.min(dayStart, ...items.map((i) => i.start)) - (Math.min(dayStart, ...items.map((i) => i.start)) % 60);
  const e0 = Math.max(dayEnd, ...items.map((i) => i.end));
  const height = (e0 - s0) * ppm;
  const y = (m) => (m - s0) * ppm;

  const hours = h('div', { class: 'tl-hours', style: { height: `${height}px` } });
  const track = h('div', { class: 'tl-track', style: { height: `${height}px` } });
  for (let m = s0; m <= e0; m += 30) {
    track.append(h('div', { class: `tl-line${m % 60 ? ' is-half' : ''}`, style: { top: `${y(m)}px` } }));
    if (m % 60 === 0) hours.append(h('div', { class: 'tl-hour', style: { top: `${y(m)}px` } }, toHHMM(m)));
  }
  const isToday = key === dateKey();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  if (showFree) {
    // em dias passados não há tempo livre "à frente"; hoje, só a partir de agora
    const fromMin = isToday ? nowMin : key < dateKey() ? 24 * 60 : null;
    for (const w of freeWindows(items, settings, 30, fromMin)) {
      track.append(h('div', { class: 'tl-free', style: { top: `${y(w.start) + 2}px`, height: `${(w.end - w.start) * ppm - 4}px` } }, `livre · ${fmtDur(w.end - w.start)}`));
    }
  }

  for (const it of layoutColumns(items)) {
    const w = 100 / it.cols;
    const past = isToday ? it.end < nowMin : key < dateKey();
    const cls = ['tl-item', `is-${it.type}`, it.mode ? 'has-mode' : '', it.status === 'done' ? 'is-done' : '', it.status === 'skipped' ? 'is-skipped' : '', past ? 'is-past' : ''].filter(Boolean).join(' ');
    const hgt = Math.max(26, (it.end - it.start) * ppm - 3);
    const el = h('button', {
      class: cls, '--c': it.mode?.color,
      style: { top: `${y(it.start) + 1}px`, height: `${hgt}px`, left: `calc(${it.col * w}% + 6px)`, width: `calc(${w}% - 12px)` },
      'aria-label': `${it.title}, ${toHHMM(it.start)} a ${toHHMM(it.end)}${it.status === 'done' ? ', feito' : it.status === 'skipped' ? ', pulado' : ''}`,
    },
      h('span', { class: 'tl-item-title' }, it.title),
      hgt > 40 ? h('span', { class: 'tl-item-time' }, `${toHHMM(it.start)}–${toHHMM(it.end)} · ${fmtDur(it.end - it.start)}${it.type === 'event' ? ' · Google Agenda' : it.type === 'suggestion' ? ' · sugestão aceita' : ''}`) : null,
    );
    el.addEventListener('click', () => onItem?.(it));
    track.append(el);
  }
  if (isToday && nowMin >= s0 && nowMin <= e0) track.append(h('div', { class: 'tl-now', style: { top: `${y(nowMin)}px` } }));

  const wrap = h('div', { class: 'tl' }, hours, track);
  return { el: wrap, scrollTo: isToday ? Math.max(0, y(nowMin) - 120) : Math.max(0, y(dayStart) - 20) };
}

export function legend() {
  return h('div', { class: 'legend' },
    h('span', null, h('i'), 'pendente'), h('span', null, h('i', { class: 'l-done' }), 'feito'),
    h('span', null, h('i', { class: 'l-skip' }), 'pulado'), h('span', null, h('i', { class: 'l-event' }), 'Google Agenda'));
}

export function readOnlyNotice() {
  return store.canWrite() ? null : h('div', { class: 'banner', role: 'note' }, icon('lock'),
    h('span', null, 'Modo leitura. Este site no GitHub Pages só mostra os dados. Para editar, rode ', h('b', null, 'start.cmd'), ' no seu PC e depois faça commit/push.'));
}

/* ---------- 2.0: blocos, anel e abas ---------- */
export function tile({ title, iconName, actions, cls = '', span = 12, flush = false, label }, ...children) {
  return h('section', { class: `tile span-${span}${flush ? ' tile--flush' : ''} ${cls}`.trim(), 'aria-label': label || title },
    title ? h('div', { class: 'tile-head' }, h('h2', null, iconName ? icon(iconName, 16) : null, title), actions ? h('div', { class: 'row' }, actions) : null) : null,
    ...children);
}

/** Anel de progresso animado; `center` aparece no meio. */
export function ring(frac, center, { size = 96, color } = {}) {
  const r = 40, c = 2 * Math.PI * r;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 96 96'); svg.setAttribute('class', 'ring'); svg.setAttribute('aria-hidden', 'true');
  svg.style.width = svg.style.height = `${size}px`;
  svg.innerHTML = `<circle class="ring-bg" cx="48" cy="48" r="${r}"/><circle class="ring-fg" cx="48" cy="48" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${c.toFixed(2)}"${color ? ` style="stroke:${color}"` : ''}/>`;
  requestAnimationFrame(() => requestAnimationFrame(() => { svg.querySelector('.ring-fg').style.strokeDashoffset = (c * (1 - Math.max(0, Math.min(1, frac)))).toFixed(2); }));
  return h('div', { class: 'ring-center' }, svg, h('b', null, center));
}

/** Abas acessíveis; `panels` = [{id, label, count?, render: () => Node}]. Lembra a aba por tela. */
export function tabs(key, panels) {
  let current = panels[0].id;
  try { const saved = sessionStorage.getItem(`planlife.tab.${key}`); if (panels.some((p) => p.id === saved)) current = saved; } catch { }
  const bar = h('div', { class: 'tabs', role: 'tablist' });
  const host = h('div', { class: 'stack', style: { gap: '16px' } });
  const show = (id) => {
    current = id;
    try { sessionStorage.setItem(`planlife.tab.${key}`, id); } catch { }
    bar.querySelectorAll('button').forEach((b) => { const on = b.dataset.id === id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    host.replaceChildren(panels.find((p) => p.id === id).render());
  };
  panels.forEach((p) => {
    const b = h('button', { role: 'tab', type: 'button', 'data-id': p.id }, p.label, p.count !== undefined ? h('span', { class: 'tab-count' }, p.count) : null);
    b.addEventListener('click', () => show(p.id));
    b.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const i = panels.findIndex((x) => x.id === current);
      const n = panels[(i + (e.key === 'ArrowRight' ? 1 : panels.length - 1)) % panels.length];
      show(n.id); bar.querySelector(`[data-id="${n.id}"]`).focus();
    });
    bar.append(b);
  });
  show(current);
  return h('div', { class: 'stack', style: { gap: '16px' } }, bar, host);
}

/** Numera os filhos da grade para a entrada escalonada. */
export const stagger = (el) => { [...el.children].forEach((c, i) => c.style.setProperty('--i', i)); return el; };

/** Aviso para os dados de exemplo que vêm com o app, com remoção em um clique. */
export async function exampleNotice(onDone) {
  const [blocks, cycles] = await Promise.all([store.items('routine/blocks'), store.items('focus/cycles')]);
  const n = blocks.filter((b) => b.example).length + cycles.filter((c) => c.example).length;
  if (!n) return null;
  const btn = store.canWrite() ? h('button', {
    class: 'btn btn--sm', style: { marginLeft: 'auto' }, onclick: async () => {
      if (!confirm(`Apagar os ${n} itens de exemplo (rotina e ciclos)? O que você criou continua.`)) return;
      const ok = await guard(async () => {
        for (const p of ['routine/blocks', 'focus/cycles']) { const d = await store.load(p); d.items = d.items.filter((x) => !x.example); await store.save(p, d); }
      }, 'Exemplos apagados');
      if (ok) onDone?.();
    },
  }, icon('trash', 15), 'Apagar exemplos') : null;
  return h('div', { class: 'banner', role: 'note' }, icon('spark'),
    h('span', null, 'Rotina e ciclos de exemplo. Edite cada item para torná-lo seu, ou apague todos e comece do zero.'), btn);
}

export { clear };
