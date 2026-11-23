import * as store from '../store.js';
import { h, icon, dateKey, addDays, startOfWeek, isoWeekday, toMin, toHHMM, fmtDur, uid, WEEKDAYS_SHORT, WEEKDAYS_LONG, pad } from '../util.js';
import { getSettings, modesById, layoutColumns } from '../planning.js';
import { drawer, field, weekdayPicker, guard, readOnlyNotice, modeChip, exampleNotice, tabs } from '../components.js';

export default async function render(view, ctx) {
  const [settings, modes, blocks] = await Promise.all([getSettings(), modesById(), store.items('routine/blocks')]);
  const active = blocks.filter((b) => b.active !== false);
  const weekly = active.reduce((a, b) => a + (toMin(b.end) - toMin(b.start)) * (b.weekdays?.length || 0), 0);

  ctx.header({
    title: 'Rotina principal',
    line: [`${active.length} blocos`, `${fmtDur(weekly)} por semana`, 'A IA nunca altera estes blocos'],
    actions: [store.canWrite() ? h('button', { class: 'btn btn--primary', onclick: () => edit(null) }, icon('plus', 16), 'Novo bloco') : null],
  });
  view.append(readOnlyNotice() || '', (await exampleNotice(() => ctx.refresh())) || '');

  // ---------- Grade semanal ----------
  const ppm = 0.8;
  const s0 = Math.min(toMin(settings.day?.start || '06:00'), ...active.map((b) => toMin(b.start))) ;
  const start = s0 - (s0 % 60);
  const end = Math.max(toMin(settings.day?.end || '23:00'), ...active.map((b) => toMin(b.end)));
  const height = (end - start) * ppm;
  const today = isoWeekday(new Date());
  const week = h('div', { class: 'week' });
  week.append(h('div', { class: 'week-head' }));
  WEEKDAYS_LONG.forEach((d, i) => {
    const mins = active.filter((b) => b.weekdays?.includes(i + 1)).reduce((a, b) => a + toMin(b.end) - toMin(b.start), 0);
    week.append(h('div', { class: `week-head${i + 1 === today ? ' is-today' : ''}` }, d.charAt(0).toUpperCase() + d.slice(1), h('small', null, fmtDur(mins))));
  });
  const hours = h('div', { class: 'tl-hours', style: { height: `${height}px` } });
  for (let m = start; m <= end; m += 60) hours.append(h('div', { class: 'tl-hour', style: { top: `${(m - start) * ppm}px` } }, toHHMM(m)));
  week.append(hours);
  for (let d = 1; d <= 7; d++) {
    const col = h('div', { class: `week-col${d === today ? ' is-today' : ''}`, style: { height: `${height}px` } });
    for (let m = start; m <= end; m += 60) col.append(h('div', { class: 'tl-line', style: { top: `${(m - start) * ppm}px` } }));
    const items = active.filter((b) => b.weekdays?.includes(d)).map((b) => ({ id: b.id, start: toMin(b.start), end: toMin(b.end), b })).sort((a, b) => a.start - b.start);
    for (const it of layoutColumns(items)) {
      const m = modes[it.b.modeId];
      const w = 100 / it.cols;
      const hgt = Math.max(20, (it.end - it.start) * ppm - 2);
      const el = h('button', {
        class: `tl-item is-done${m ? ' has-mode' : ''}`, '--c': m?.color || 'var(--ink-2)',
        style: { top: `${(it.start - start) * ppm + 1}px`, height: `${hgt}px`, left: `calc(${it.col * w}% + 3px)`, width: `calc(${w}% - 6px)` },
        'aria-label': `${it.b.title}, ${WEEKDAYS_LONG[d - 1]}, ${it.b.start} a ${it.b.end}`,
      }, h('span', { class: 'tl-item-title', style: { '--hide': 1 } }, it.b.title), hgt > 34 ? h('span', { class: 'tl-item-time' }, `${it.b.start}–${it.b.end}`) : null);
      el.classList.remove('is-done'); // grade usa o estilo sólido sem o selo de concluído
      el.style.borderStyle = 'solid';
      el.addEventListener('click', (e) => { e.stopPropagation(); edit(it.b); });
      col.append(el);
    }
    if (store.canWrite()) col.addEventListener('dblclick', (e) => {
      const rect = col.getBoundingClientRect();
      const min = Math.round(((e.clientY - rect.top) / ppm + start) / 15) * 15;
      edit(null, { weekdays: [d], start: toHHMM(min), end: toHHMM(Math.min(min + 60, 1439)) });
    });
    week.append(col);
  }
  const weekSec = (h('section', { class: 'panel', 'aria-label': 'Semana da rotina' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Semana'), h('p', null, store.canWrite() ? 'Clique num bloco para editar. Dois cliques num espaço vazio criam um bloco ali.' : 'Visualização')),
    h('div', { class: 'panel-body--scroll' }, h('div', { class: 'week-scroll' }, week))));

  // ---------- Lista ----------
  const rows = [...blocks].sort((a, b) => a.start.localeCompare(b.start));
  const listSec = (h('section', { class: 'panel', 'aria-label': 'Todos os blocos' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Todos os blocos')),
    rows.length ? h('div', { class: 'panel-body--scroll' }, h('table', { class: 'table' },
      h('thead', null, h('tr', null, h('th', null, 'Bloco'), h('th', null, 'Horário'), h('th', null, 'Dias'), h('th', null, 'Área'), h('th', { class: 'r' }, ''))),
      h('tbody', null, rows.map((b) => h('tr', { style: b.active === false ? { opacity: .5 } : null },
        h('td', null, h('b', null, b.title), b.notes ? h('div', { class: 'muted', style: { fontSize: '13px' } }, b.notes) : null),
        h('td', { class: 'num', style: { fontSize: '16px' } }, `${b.start}–${b.end}`),
        h('td', null, (b.weekdays || []).length === 7 ? 'todos os dias' : (b.weekdays || []).map((d) => WEEKDAYS_SHORT[d - 1]).join(', ')),
        h('td', null, modeChip(modes[b.modeId]) || h('span', { class: 'muted' }, 'geral')),
        h('td', null, store.canWrite() ? h('div', { class: 'table-actions' }, h('button', { class: 'iconbtn', 'aria-label': `Editar ${b.title}`, onclick: () => edit(b) }, icon('edit', 16))) : null))))))
      : h('div', { class: 'empty' }, h('h3', null, 'Sua rotina começa aqui'), h('p', null, 'Cadastre os blocos fixos da semana: sono, trabalho, treino, estudo. Eles são a base que a IA respeita.'))));

  view.append(tabs('rotina', [
    { id: 'semana', label: 'Semana', render: () => weekSec },
    { id: 'lista', label: 'Todos os blocos', count: blocks.length, render: () => listSec },
  ]));

  function edit(b, preset = {}) {
    if (!store.canWrite()) return;
    const isNew = !b;
    b = b || { id: uid('b-'), title: '', start: '07:00', end: '08:00', weekdays: [1, 2, 3, 4, 5], modeId: null, notes: '', active: true, ...preset };
    const title = h('input', { class: 'input', value: b.title, placeholder: 'Ex.: Treino, Trabalho, Leitura', required: true });
    const st = h('input', { class: 'input', type: 'time', value: b.start, step: 300 });
    const en = h('input', { class: 'input', type: 'time', value: b.end, step: 300 });
    const days = weekdayPicker(b.weekdays);
    const mode = h('select', { class: 'select' }, h('option', { value: '' }, 'Geral (sem área)'), Object.values(modes).map((m) => h('option', { value: m.id, selected: m.id === b.modeId }, m.name)));
    const notes = h('textarea', { class: 'textarea', placeholder: 'Opcional' }, b.notes || '');
    const activeCb = h('input', { type: 'checkbox', checked: b.active !== false, id: 'blk-active' });
    drawer({
      title: isNew ? 'Novo bloco da rotina' : 'Editar bloco',
      body: h('div', { class: 'stack' },
        field('Nome', title),
        h('div', { class: 'grid-2' }, field('Início', st), field('Fim', en)),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Dias da semana'), days),
        field('Área', mode, 'Liga o bloco a um modo de foco (cor e contexto para a IA).'),
        field('Notas', notes),
        h('label', { class: 'row', for: 'blk-active' }, activeCb, 'Bloco ativo')),
      actions: [
        isNew ? null : (close) => h('button', { class: 'btn btn--danger', onclick: async () => { if (confirm(`Excluir “${b.title}”? Os registros de dias anteriores continuam salvos.`) && await guard(() => store.remove('routine/blocks', b.id), 'Bloco excluído')) { close(); ctx.refresh(); } } }, icon('trash', 16), 'Excluir'),
        (close) => h('button', { class: 'btn btn--ghost', onclick: close }, 'Cancelar'),
        (close) => h('button', {
          class: 'btn btn--primary', onclick: async () => {
            if (!title.value.trim()) { title.focus(); return; }
            if (en.value <= st.value) { en.focus(); return alert('O fim precisa ser depois do início.'); }
            if (!days.value().length) return alert('Escolha pelo menos um dia.');
            const ok = await guard(() => store.upsert('routine/blocks', { ...b, example: false, title: title.value.trim(), start: st.value, end: en.value, weekdays: days.value(), modeId: mode.value || null, notes: notes.value.trim(), active: activeCb.checked }), isNew ? 'Bloco criado' : 'Bloco salvo');
            if (ok) { close(); ctx.refresh(); }
          },
        }, isNew ? 'Criar bloco' : 'Salvar'),
      ].filter(Boolean),
    });
  }
}
