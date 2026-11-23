import * as store from '../store.js';
import { h, icon, dateKey, fromKey, addDays, startOfWeek, startOfMonth, endOfMonth, isoWeekday, fmtMonth, fmtShort, uid, WEEKDAYS_SHORT, isoWeek } from '../util.js';
import { modesById, cyclesOn, cycleProgress, KIND_LABEL } from '../planning.js';
import { periodStrip, drawer, field, weekdayPicker, swatchPicker, guard, readOnlyNotice, modeChip, tabs } from '../components.js';

export default async function render(view, ctx) {
  const [modes, cycles] = await Promise.all([modesById(), store.items('focus/cycles')]);
  const sel = ctx.params.get('d') || dateKey();
  const selDate = fromKey(sel);
  const month = ctx.params.get('m') ? fromKey(ctx.params.get('m') + '-01') : startOfMonth(selDate);
  const can = store.canWrite();

  ctx.header({
    title: 'Ciclos de foco',
    line: ['Mês, semana ou dias específicos', 'O ciclo mais específico define o foco do dia'],
    actions: [can ? h('button', { class: 'btn btn--primary', onclick: () => editCycle(null, sel) }, icon('plus', 16), 'Novo ciclo') : null],
  });
  view.append(readOnlyNotice() || '');

  view.append(periodStrip({
    cycles, modes, from: addDays(startOfWeek(selDate), -7), weeks: 6, title: 'Temporada',
    onDay: (k) => ctx.go(`#/ciclos?d=${k}`),
  }));

  // ---------- Mês ----------
  const first = startOfWeek(startOfMonth(month));
  const last = addDays(startOfWeek(endOfMonth(month)), 6);
  const grid = h('div', { class: 'month', role: 'grid' }, WEEKDAYS_SHORT.map((d) => h('div', { class: 'month-wd' }, d)));
  for (let d = first; d <= last; d = addDays(d, 1)) {
    const k = dateKey(d);
    const cs = cyclesOn(k, cycles);
    const cell = h('button', {
      class: `month-day${d.getMonth() !== month.getMonth() ? ' is-out' : ''}${k === dateKey() ? ' is-today' : ''}${k === sel ? ' is-sel' : ''}`,
      'aria-label': `${fmtShort(d)}${cs.length ? ': ' + cs.map((c) => modes[c.modeId]?.name).join(', ') : ''}`,
      onclick: () => ctx.go(`#/ciclos?d=${k}&m=${k.slice(0, 7)}`),
    }, h('span', { class: 'month-num' }, d.getDate()));
    for (const c of cs) {
      const m = modes[c.modeId]; if (!m) continue;
      const cont = k !== c.startDate && isoWeekday(d) !== 1 && cyclesOn(dateKey(addDays(d, -1)), [c]).length;
      cell.append(h('span', { class: `month-band${cont ? ' is-cont' : ''}`, '--c': m.color }, m.name));
    }
    grid.append(cell);
  }
  const mPrev = dateKey(new Date(month.getFullYear(), month.getMonth() - 1, 1)).slice(0, 7);
  const mNext = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 1)).slice(0, 7);
  const monthPanel = h('section', { class: 'panel', 'aria-label': 'Calendário do mês' },
    h('div', { class: 'panel-head' }, h('h2', null, fmtMonth(month)),
      h('div', { class: 'row' },
        h('button', { class: 'iconbtn', 'aria-label': 'Mês anterior', onclick: () => ctx.go(`#/ciclos?d=${sel}&m=${mPrev}`) }, icon('left')),
        h('button', { class: 'iconbtn', 'aria-label': 'Próximo mês', onclick: () => ctx.go(`#/ciclos?d=${sel}&m=${mNext}`) }, icon('right')))),
    grid);

  // ---------- Dia selecionado + lista ----------
  const daySide = h('div', { class: 'stack', style: { gap: '24px' } });
  const onDay = cyclesOn(sel, cycles);
  const dayPanel = h('section', { class: 'panel', 'aria-label': 'Dia selecionado' },
    h('div', { class: 'panel-head' }, h('div', null, h('h2', null, fmtShort(selDate) + ` · ${WEEKDAYS_SHORT[isoWeekday(selDate) - 1]}`), h('p', null, onDay.length ? `Foco principal: ${modes[onDay[0].modeId]?.name}` : 'Sem ciclo neste dia'))));
  if (can) {
    const quick = h('div', { class: 'panel-body stack' },
      h('p', { class: 'note' }, 'Aplicar um foco a partir deste dia:'),
      h('div', { class: 'row' }, Object.values(modes).map((m) => h('button', { class: 'btn btn--sm', onclick: () => editCycle(null, sel, { modeId: m.id }) }, h('span', { class: 'dot', '--c': m.color }), m.name))));
    dayPanel.append(quick);
  }
  daySide.append(dayPanel);

  const list = h('section', { class: 'panel', 'aria-label': 'Ciclos' }, h('div', { class: 'panel-head' }, h('h2', null, 'Ciclos'), h('p', null, `${cycles.length} no total`)));
  const sorted = [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (!sorted.length) list.append(h('div', { class: 'empty' }, h('h3', null, 'Nenhum ciclo ainda'), h('p', null, 'Um ciclo dá direção a um período: “Novembro de Inglês”, “Semana de Saúde”, “Segundas e terças para Finanças”.')));
  for (const c of sorted) {
    const m = modes[c.modeId];
    const p = cycleProgress(c, dateKey());
    const status = dateKey() < c.startDate ? 'próximo' : dateKey() > c.endDate ? 'encerrado' : `dia ${p.idx} de ${p.total}`;
    // posição do ciclo numa janela de 8 semanas a partir da semana passada
    const winStart = addDays(startOfWeek(new Date()), -7); const winDays = 56;
    const off = (k) => Math.min(winDays, Math.max(0, Math.round((fromKey(k) - winStart) / 86400000)));
    const a = off(c.startDate), z = off(dateKey(addDays(fromKey(c.endDate), 1)));
    const nowOff = (Date.now() - winStart) / 86400000;
    list.append(h('div', { class: 'cycle-row', '--c': m?.color, style: dateKey() > c.endDate ? { opacity: .6 } : null },
      h('div', null,
        h('b', null, `${m?.name || 'Modo removido'} · ${KIND_LABEL[c.kind]}`),
        h('div', { class: 'cycle-run', 'aria-hidden': 'true' },
          z > a ? h('i', { style: { left: `${(a / winDays) * 100}%`, width: `${((z - a) / winDays) * 100}%` } }) : null,
          h('b', { style: { left: `${(nowOff / winDays) * 100}%` } })),
        h('small', null, `${fmtShort(fromKey(c.startDate))} a ${fmtShort(fromKey(c.endDate))}${c.weekdays?.length ? ' · só ' + c.weekdays.map((d) => WEEKDAYS_SHORT[d - 1]).join(', ') : ''} · ${status}`),
        c.goal ? h('small', null, c.goal) : null),
      can ? h('button', { class: 'iconbtn', 'aria-label': 'Editar ciclo', onclick: () => editCycle(c) }, icon('edit', 16)) : h('span')));
  }


  // ---------- Modos de foco ----------
  const modePanel = h('section', { class: 'panel', 'aria-label': 'Modos de foco' },
    h('div', { class: 'panel-head' }, h('div', null, h('h2', null, 'Modos de foco'), h('p', null, 'Cada modo diz à IA o que priorizar.')),
      can ? h('div', { class: 'row' }, h('button', { class: 'btn btn--sm', onclick: () => editMode(null) }, icon('plus', 15), 'Novo modo')) : null),
    h('div', { class: 'mode-list' }, Object.values(modes).map((m) => h('button', { class: 'mode-item', '--c': m.color, onclick: () => can && editMode(m), disabled: !can },
      h('h3', null, h('span', { class: 'mode-swatch' }), m.name), h('p', null, m.description || ''),
      h('p', null, `${(m.ideas || []).length} ideias rápidas`)))));
  const calSplit = h('div', { class: 'split split--wide' }, monthPanel, daySide);
  view.append(tabs('ciclos', [
    { id: 'calendario', label: 'Calendário', render: () => calSplit },
    { id: 'ciclos', label: 'Ciclos', count: cycles.length, render: () => list },
    { id: 'modos', label: 'Modos de foco', count: Object.keys(modes).length, render: () => modePanel },
  ]));

  // ---------- Formulários ----------
  function editCycle(c, anchor = sel, preset = {}) {
    const isNew = !c;
    c = c || { id: uid('c-'), modeId: Object.keys(modes)[0], kind: 'week', startDate: anchor, endDate: anchor, weekdays: [], goal: '', ...preset };
    const mode = h('select', { class: 'select' }, Object.values(modes).map((m) => h('option', { value: m.id, selected: m.id === c.modeId }, m.name)));
    let kind = c.kind;
    const startI = h('input', { class: 'input', type: 'date', value: c.startDate });
    const endI = h('input', { class: 'input', type: 'date', value: c.endDate });
    const anchorD = fromKey(anchor);
    const applyKind = () => {
      if (kind === 'week') { startI.value = dateKey(startOfWeek(anchorD)); endI.value = dateKey(addDays(startOfWeek(anchorD), 6)); }
      if (kind === 'month') { startI.value = dateKey(startOfMonth(anchorD)); endI.value = dateKey(endOfMonth(anchorD)); }
    };
    const kindSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Tipo de ciclo' }, [['month', 'Mês'], ['week', 'Semana'], ['custom', 'Período / dias']].map(([v, l]) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(v === kind) }, l);
      b.addEventListener('click', () => { kind = v; kindSeg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); applyKind(); });
      return b;
    }));
    if (isNew && kind !== 'custom') applyKind();
    const days = weekdayPicker(c.weekdays);
    const goal = h('textarea', { class: 'textarea', placeholder: 'Ex.: Praticar inglês todos os dias, mesmo que 15 minutos.' }, c.goal || '');
    drawer({
      title: isNew ? 'Novo ciclo de foco' : 'Editar ciclo',
      body: h('div', { class: 'stack' },
        field('Modo de foco', mode),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Duração'), kindSeg, h('small', null, `Semana e mês usam o dia ${fmtShort(anchorD)} como referência. Ajuste as datas se quiser.`)),
        h('div', { class: 'grid-2' }, field('Início', startI), field('Fim', endI)),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Só em alguns dias da semana'), days, h('small', null, 'Deixe vazio para valer todos os dias. Ex.: seg e ter para Finanças.')),
        field('Meta do ciclo', goal, 'A IA usa a meta para escolher sugestões.')),
      actions: [
        isNew ? null : (close) => h('button', { class: 'btn btn--danger', onclick: async () => { if (confirm('Excluir este ciclo?') && await guard(() => store.remove('focus/cycles', c.id), 'Ciclo excluído')) { close(); ctx.refresh(); } } }, icon('trash', 16), 'Excluir'),
        (close) => h('button', { class: 'btn btn--ghost', onclick: close }, 'Cancelar'),
        (close) => h('button', {
          class: 'btn btn--primary', onclick: async () => {
            if (!startI.value || !endI.value || endI.value < startI.value) return alert('Confira as datas: o fim precisa ser igual ou depois do início.');
            const ok = await guard(() => store.upsert('focus/cycles', { ...c, example: false, modeId: mode.value, kind, startDate: startI.value, endDate: endI.value, weekdays: days.value(), goal: goal.value.trim() }), isNew ? 'Ciclo criado' : 'Ciclo salvo');
            if (ok) { close(); ctx.refresh(); }
          },
        }, isNew ? 'Criar ciclo' : 'Salvar'),
      ].filter(Boolean),
    });
  }

  function editMode(m) {
    const isNew = !m;
    m = m || { id: uid('m-'), name: '', color: '', description: '', aiBrief: '', ideas: [], builtin: false };
    const name = h('input', { class: 'input', value: m.name, placeholder: 'Ex.: Leitura, Espiritualidade, Projeto pessoal' });
    const color = swatchPicker(m.color);
    const desc = h('input', { class: 'input', value: m.description || '', placeholder: 'Uma linha sobre o modo' });
    const brief = h('textarea', { class: 'textarea', placeholder: 'O que a IA deve priorizar quando este foco estiver ativo?' }, m.aiBrief || '');
    const ideas = h('textarea', { class: 'textarea', placeholder: 'Uma ideia por linha' }, (m.ideas || []).join('\n'));
    const used = cycles.some((c) => c.modeId === m.id);
    drawer({
      title: isNew ? 'Novo modo de foco' : `Modo: ${m.name}`,
      body: h('div', { class: 'stack' },
        field('Nome', name), h('div', { class: 'field' }, h('span', { class: 'label' }, 'Cor da faixa'), color),
        field('Descrição', desc), field('Instruções para a IA', brief, 'Seja específico: limites, preferências, o que evitar.'),
        field('Ideias rápidas', ideas, 'Aparecem em Hoje como atalhos, mesmo sem IA configurada.')),
      actions: [
        isNew || used ? null : (close) => h('button', { class: 'btn btn--danger', onclick: async () => { if (confirm(`Excluir o modo “${m.name}”?`) && await guard(() => store.remove('focus/modes', m.id), 'Modo excluído')) { close(); ctx.refresh(); } } }, icon('trash', 16), 'Excluir'),
        (close) => h('button', { class: 'btn btn--ghost', onclick: close }, 'Cancelar'),
        (close) => h('button', {
          class: 'btn btn--primary', onclick: async () => {
            if (!name.value.trim()) { name.focus(); return; }
            const ok = await guard(() => store.upsert('focus/modes', { ...m, name: name.value.trim(), color: color.value(), description: desc.value.trim(), aiBrief: brief.value.trim(), ideas: ideas.value.split('\n').map((x) => x.trim()).filter(Boolean) }), 'Modo salvo');
            if (ok) { close(); ctx.refresh(); }
          },
        }, 'Salvar'),
      ].filter(Boolean),
    });
  }
}
