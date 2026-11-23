// Hoje (2.0): painel bento. Primeiro o que importa agora, depois a temporada, depois o dia inteiro.
import * as store from '../store.js';
import * as ai from '../ai.js';
import { h, icon, dateKey, fromKey, addDays, isoWeek, startOfWeek, fmtDayLong, fmtShort, toMin, toHHMM, fmtDur, uid, isoWeekday } from '../util.js';
import { getSettings, modesById, cyclesOn, cycleProgress, dayItems, freeWindows, setBlockStatus } from '../planning.js';
import { periodStrip, timeline, legend, guard, drawer, modeChip, readOnlyNotice, exampleNotice, tile, ring, stagger } from '../components.js';
import { suggestionRow } from './assistant.js';

export default async function render(view, ctx) {
  const key = ctx.params.get('d') || dateKey();
  const day = fromKey(key);
  const isToday = key === dateKey();
  const [settings, modes, cycles, sugg] = await Promise.all([getSettings(), modesById(), store.items('focus/cycles'), store.items('ai/suggestions')]);
  const wkStart = startOfWeek(day);
  const events = await ctx.events(addDays(wkStart, -7), addDays(wkStart, 35));
  const items = await dayItems(key, { events });
  const active = cyclesOn(key, cycles);
  const rerender = () => ctx.refresh();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const askAI = async (btn) => {
    if (!(await ai.isReady())) { ctx.go('#/ajustes'); return; }
    btn.classList.add('is-busy');
    const ok = await guard(() => ai.suggest([key], { events }), 'Sugestões prontas. Aceite ou recuse cada uma.');
    btn.classList.remove('is-busy');
    if (ok) rerender();
  };

  ctx.header({
    title: isToday ? `Hoje, ${fmtDayLong(day).toLowerCase()}` : fmtDayLong(day),
    line: [`Semana ${isoWeek(day)} · ${fmtShort(wkStart)} a ${fmtShort(addDays(wkStart, 6))}`],
    actions: [
      h('button', { class: 'iconbtn', 'aria-label': 'Dia anterior', onclick: () => ctx.go(`#/hoje?d=${dateKey(addDays(day, -1))}`) }, icon('left')),
      isToday ? null : h('button', { class: 'btn btn--sm', onclick: () => ctx.go('#/hoje') }, 'Hoje'),
      h('button', { class: 'iconbtn', 'aria-label': 'Próximo dia', onclick: () => ctx.go(`#/hoje?d=${dateKey(addDays(day, 1))}`) }, icon('right')),
    ],
  });
  view.append(readOnlyNotice() || '', (await exampleNotice(() => ctx.refresh())) || '');

  const grid = h('div', { class: 'bento' });

  /* ---------- Agora ---------- */
  grid.append(nowTile({ items, isToday, nowMin, key, settings, rerender }));

  /* ---------- Ritmo do dia (anel) ---------- */
  const routine = items.filter((i) => i.type === 'routine');
  const done = routine.filter((i) => i.status === 'done').length;
  const free = freeWindows(items, settings, 15, isToday ? nowMin : key < dateKey() ? 1440 : null).reduce((a, w) => a + (w.end - w.start), 0);
  const extrasMin = items.filter((i) => i.type === 'suggestion').reduce((a, i) => a + (i.end - i.start), 0);
  grid.append(tile({ title: 'Ritmo do dia', iconName: 'routine', span: 3 },
    h('div', { class: 'ring-wrap' },
      ring(routine.length ? done / routine.length : 0, `${done}/${routine.length}`),
      h('div', { class: 'ring-stats' },
        h('div', null, h('b', null, fmtDur(free)), h('span', null, isToday ? 'livre a partir de agora' : key < dateKey() ? 'livre (dia passado)' : 'livre no dia')),
        h('div', null, h('b', null, fmtDur(extrasMin)), h('span', null, 'em extras aceitos'))))));

  /* ---------- Ciclo ativo ---------- */
  grid.append(cycleTile({ active, modes, key, askAI }));

  /* ---------- Temporada (faixa de periodização) ---------- */
  const strip = periodStrip({
    cycles, modes, from: addDays(day, -7), weeks: 5, today: dateKey(), animate: ctx.first, title: 'Temporada',
    onDay: (k) => ctx.go(`#/hoje?d=${k}`),
    actions: [h('a', { class: 'tile-link', href: `#/ciclos?d=${key}` }, 'Planejar ciclos')],
  });
  strip.classList.add('span-12');
  grid.append(strip);

  /* ---------- Linha do tempo ---------- */
  const tl = timeline({ items, settings, dayKey: key, onItem: (it) => openItem(it, key, rerender) });
  const scroller = h('div', { class: 'tl-scroll', style: { maxHeight: '560px' } }, tl.el);
  grid.append(tile({ title: 'O dia', iconName: 'clock', span: 7, flush: true, actions: [legend()] }, scroller));

  /* ---------- Sugestões ---------- */
  const daySugg = sugg.filter((s) => s.date === key && s.status === 'pending');
  const questions = sugg.filter((s) => s.kind === 'question' && s.status === 'pending' && s.date !== key);
  const extras = sugg.filter((s) => s.date === key && ['accepted', 'done'].includes(s.status) && s.kind === 'task' && !s.start);
  const list = [...daySugg, ...questions];
  const side = h('div', { class: 'span-5', style: { display: 'flex', flexDirection: 'column', gap: '16px' } });
  const suggTile = tile({
    title: 'Sugestões do ciclo', iconName: 'spark', flush: true, span: 12, cls: 'sugg-mini',
    actions: [list.length > 3 ? h('a', { class: 'tile-link', href: '#/assistente' }, `Ver todas (${list.length})`) : null],
  });
  suggTile.classList.remove('span-12');
  if (list.length) list.slice(0, 3).forEach((s) => suggTile.append(suggestionRow(s, modes, { onChange: rerender })));
  else suggTile.append(h('div', { class: 'empty', style: { padding: '18px 20px' } },
    h('h3', null, active.length ? 'Nada pendente' : 'Sem ciclo, sem sugestões'),
    h('p', null, active.length ? 'A rotina não muda. Peça sugestões para as janelas livres ou use uma ideia rápida.' : 'Crie um ciclo de foco para receber sugestões alinhadas a ele.')));
  const ideaModes = active.map((c) => modes[c.modeId]).filter((m) => m?.ideas?.length);
  if (ideaModes.length && store.canWrite()) {
    const ideas = h('div', { class: 'ideas', 'aria-label': 'Ideias rápidas do ciclo' });
    for (const m of ideaModes) for (const idea of m.ideas.slice(0, 3)) {
      if (sugg.some((s) => s.date === key && s.title === idea)) continue;
      ideas.append(h('button', {
        '--c': m.color, title: `Adicionar ao dia (${m.name})`,
        onclick: () => guard(() => store.upsert('ai/suggestions', { id: uid('s-'), date: key, kind: 'task', modeId: m.id, title: idea, detail: '', start: null, durationMin: 30, status: 'accepted', answer: null, source: { provider: 'ideias', model: m.name }, decidedAt: new Date().toISOString() }), 'Adicionado ao dia').then(rerender),
      }, icon('plus', 14), idea));
    }
    if (ideas.childElementCount) suggTile.append(ideas);
  }
  side.append(suggTile);
  if (extras.length) {
    const ex = tile({ title: 'Extras aceitos', iconName: 'check', flush: true, cls: 'sugg-mini' });
    extras.forEach((s) => ex.append(suggestionRow(s, modes, { onChange: rerender })));
    side.append(ex);
  }
  grid.append(side);

  view.append(stagger(grid));
  requestAnimationFrame(() => { scroller.scrollTop = tl.scrollTo; });
}

function nowTile({ items, isToday, nowMin, key, settings, rerender }) {
  const timed = items.filter((i) => i.type !== 'event' || true);
  let body;
  if (!isToday) {
    const first = timed[0];
    body = [
      h('div', { class: 'now-title' }, key < dateKey() ? 'Dia encerrado' : 'Dia planejado', h('small', null, `${timed.length} itens na agenda`)),
      first ? h('div', { class: 'now-next' }, icon('clock', 16), 'Começa com ', h('b', null, first.title), ` às ${toHHMM(first.start)}`) : h('p', { class: 'tile-meta' }, 'Nenhum compromisso neste dia.'),
    ];
  } else {
    const current = timed.find((i) => i.start <= nowMin && nowMin < i.end);
    const next = timed.find((i) => i.start > nowMin);
    if (current) {
      const frac = (nowMin - current.start) / (current.end - current.start);
      body = [
        h('div', { class: 'now-title' }, current.title, h('small', null, `até ${toHHMM(current.end)} · faltam ${fmtDur(current.end - nowMin)}`)),
        h('div', { class: 'now-bar', role: 'progressbar', 'aria-label': 'Tempo decorrido do bloco atual', 'aria-valuenow': Math.round(frac * 100), 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: { width: `${frac * 100}%` } })),
        next ? h('div', { class: 'now-next' }, icon('right', 16), 'Depois: ', h('b', null, next.title), ` às ${toHHMM(next.start)}`) : h('div', { class: 'now-next' }, 'Último compromisso do dia.'),
      ];
      if (current.type === 'routine' && current.status !== 'done' && store.canWrite()) {
        body.push(h('div', { class: 'tile-foot' }, h('button', {
          class: 'btn btn--mode btn--sm', onclick: async () => { if (await guard(() => setBlockStatus(key, current.id, 'done'), 'Bloco marcado como feito')) rerender(); },
        }, icon('check', 15), 'Marcar como feito')));
      }
    } else if (next) {
      body = [
        h('div', { class: 'now-title' }, 'Livre agora', h('small', null, `por ${fmtDur(next.start - nowMin)}`)),
        h('div', { class: 'now-next' }, icon('right', 16), 'Próximo: ', h('b', null, next.title), ` às ${toHHMM(next.start)}`),
      ];
    } else {
      const end = toMin(settings.day?.end || '23:00');
      body = [
        h('div', { class: 'now-title' }, nowMin >= end ? 'Hora de descansar' : 'Agenda concluída', h('small', null, 'nada mais hoje')),
        h('p', { class: 'tile-meta' }, 'Revise o dia de amanhã ou deixe a semana planejada em Ciclos.'),
      ];
    }
  }
  return tile({ title: isToday ? 'Agora' : 'Resumo do dia', iconName: 'today', span: 5, cls: 'now-tile' }, ...body);
}

function cycleTile({ active, modes, key, askAI }) {
  const top = active[0];
  const m = top && modes[top.modeId];
  const btn = h('button', { class: 'btn btn--mode btn--sm' }, icon('spark', 15), 'Pedir sugestões');
  btn.addEventListener('click', () => askAI(btn));
  if (!m) {
    return tile({ title: 'Ciclo de foco', iconName: 'cycles', span: 4 },
      h('div', { class: 'cycle-tile-name' }, 'Sem ciclo neste dia'),
      h('p', { class: 'cycle-tile-goal' }, 'Escolha um foco para a semana, o mês ou dias específicos. A IA passa a sugerir extras alinhados a ele.'),
      h('div', { class: 'tile-foot' }, h('a', { class: 'btn btn--sm', href: `#/ciclos?d=${key}` }, icon('plus', 15), 'Criar ciclo')));
  }
  const p = cycleProgress(top, key);
  const segs = h('div', { class: 'micro', '--c': m.color, role: 'img', 'aria-label': `Dia ${p.idx} de ${p.total} do ciclo` },
    Array.from({ length: Math.min(p.total, 31) }, (_, i) => h('i', { class: i + 1 < p.idx ? 'is-past' : i + 1 === p.idx ? 'is-today' : '' })));
  return tile({ title: 'Ciclo de foco', iconName: 'cycles', span: 4, actions: [h('span', { class: 'num muted' }, `dia ${p.idx} de ${p.total}`)] },
    h('div', { class: 'cycle-tile-name' }, h('span', { class: 'dot', '--c': m.color, style: { width: '12px', height: '12px' } }), m.name),
    top.goal ? h('p', { class: 'cycle-tile-goal' }, top.goal) : null,
    segs,
    active.length > 1 ? h('div', { class: 'cycle-tile-more' }, active.slice(1).map((c) => modeChip(modes[c.modeId], `também: ${modes[c.modeId]?.name}`))) : null,
    h('div', { class: 'tile-foot' }, btn));
}

function openItem(it, key, rerender) {
  if (it.type === 'event') { if (it.ref.link) window.open(it.ref.link, '_blank', 'noopener'); return; }
  const set = (status) => async (close) => {
    const ok = it.type === 'routine'
      ? await guard(() => setBlockStatus(key, it.id, status))
      : await guard(() => store.upsert('ai/suggestions', { id: it.id, status: status === 'done' ? 'done' : 'accepted' }));
    if (ok) { close(); rerender(); }
  };
  const btn = (label, status, cls = '') => (close) => h('button', { class: `btn ${cls}`, onclick: () => set(status)(close) }, label);
  drawer({
    title: it.title,
    body: h('div', { class: 'stack' },
      h('p', { class: 'num', style: { fontSize: '20px' } }, `${toHHMM(it.start)} – ${toHHMM(it.end)} · ${fmtDur(it.end - it.start)}`),
      it.mode ? modeChip(it.mode) : null,
      it.ref.detail ? h('p', null, it.ref.detail) : null,
      it.ref.notes ? h('p', { class: 'muted' }, it.ref.notes) : null,
      h('p', { class: 'note' }, it.type === 'routine' ? 'Bloco da rotina principal. Marcar aqui vale só para este dia.' : 'Sugestão aceita. Ela não altera a rotina principal.')),
    actions: it.type === 'routine'
      ? [btn('Voltar a pendente', null, 'btn--ghost'), btn('Pular hoje', 'skipped'), btn('Marcar feito', 'done', 'btn--primary')]
      : [btn('Desfazer conclusão', 'accepted', 'btn--ghost'), btn('Concluir', 'done', 'btn--primary')],
  });
}
