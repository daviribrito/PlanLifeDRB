import * as gcal from '../gcal.js';
import * as store from '../store.js';
import { h, icon, dateKey, fromKey, addDays, startOfWeek, isoWeek, fmtShort, WEEKDAYS_LONG, toHHMM, isoWeekday } from '../util.js';
import { getSettings, dayItems, modesById, cyclesOn } from '../planning.js';
import { guard, timeline, legend, modeChip } from '../components.js';

export default async function render(view, ctx) {
  const settings = await getSettings();
  const anchor = ctx.params.get('w') ? fromKey(ctx.params.get('w')) : new Date();
  const wk = startOfWeek(anchor);
  const connected = gcal.isConnected();
  const hasClient = !!settings.google?.clientId;

  const connectBtn = h('button', { class: 'btn btn--primary' }, icon('calendar', 16), 'Conectar Google Agenda');
  connectBtn.addEventListener('click', async () => {
    if (!hasClient) return ctx.go('#/ajustes');
    connectBtn.classList.add('is-busy');
    const ok = await guard(() => gcal.connect(), 'Google Agenda conectada');
    connectBtn.classList.remove('is-busy');
    if (ok) { ctx.clearEvents(); ctx.refresh(); }
  });

  ctx.header({
    title: 'Agenda',
    line: [`Semana ${isoWeek(wk)} · ${fmtShort(wk)} a ${fmtShort(addDays(wk, 6))}`, connected ? h('span', { class: 'status-ok' }, icon('check', 14), 'Google conectado') : h('span', { class: 'status-off' }, 'Google desconectado')],
    actions: [
      h('button', { class: 'iconbtn', 'aria-label': 'Semana anterior', onclick: () => ctx.go(`#/agenda?w=${dateKey(addDays(wk, -7))}`) }, icon('left')),
      h('button', { class: 'btn btn--sm', onclick: () => ctx.go('#/agenda') }, 'Esta semana'),
      h('button', { class: 'iconbtn', 'aria-label': 'Próxima semana', onclick: () => ctx.go(`#/agenda?w=${dateKey(addDays(wk, 7))}`) }, icon('right')),
      connected ? h('button', { class: 'btn btn--sm btn--ghost', onclick: () => { ctx.clearEvents(); ctx.refresh(); } }, icon('refresh', 15), 'Atualizar')
        : connectBtn,
    ],
  });

  if (!connected) {
    view.append(h('section', { class: 'panel' }, h('div', { class: 'empty' },
      h('h3', null, hasClient ? 'Conecte para ver seus compromissos aqui' : 'Falta cadastrar o Client ID do Google'),
      h('p', null, hasClient
        ? 'O acesso é feito direto do seu navegador. Os eventos não são salvos nos arquivos do repositório, só exibidos. A conexão dura 1 hora por sessão.'
        : 'A integração usa um Client ID OAuth seu (gratuito, no Google Cloud). O passo a passo está no README, seção Google Agenda. Depois cole o ID em Ajustes.'),
      hasClient ? connectBtn : h('a', { class: 'btn', href: '#/ajustes' }, 'Abrir Ajustes'))));
  }

  const events = await ctx.events(wk, addDays(wk, 7));
  const [modes, cycles] = await Promise.all([modesById(), store.items('focus/cycles')]);

  // grade de 7 colunas com linha do tempo por dia (rotina + Google)
  const cols = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))', gap: '0', minWidth: '1050px' } });
  for (let i = 0; i < 7; i++) {
    const d = addDays(wk, i); const k = dateKey(d);
    const items = await dayItems(k, { events });
    const top = cyclesOn(k, cycles)[0];
    const allDay = events.filter((e) => e.allDay && e.dateKey === k);
    const tl = timeline({ items, settings, dayKey: k, ppm: 0.62, showFree: false, onItem: (it) => it.type === 'event' ? it.ref.link && window.open(it.ref.link, '_blank', 'noopener') : ctx.go(`#/hoje?d=${k}`) });
    tl.el.style.gridTemplateColumns = i === 0 ? '44px 1fr' : '0 1fr';
    if (i) tl.el.querySelector('.tl-hours').style.visibility = 'hidden';
    cols.append(h('div', { style: { borderLeft: i ? '0' : '0' } },
      h('a', { href: `#/hoje?d=${k}`, class: 'week-head' + (k === dateKey() ? ' is-today' : ''), style: { display: 'block', textDecoration: 'none', color: 'inherit', position: 'static' } },
        `${WEEKDAYS_LONG[i].slice(0, 3)} ${d.getDate()}`, h('small', null, top ? modes[top.modeId]?.name : '—')),
      allDay.length ? h('div', { style: { padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: '1px solid var(--line)' } }, allDay.map((e) => h('div', { class: 'month-ev' }, e.title))) : null,
      h('div', { style: { padding: '10px 4px 10px 0' } }, tl.el)));
  }
  view.append(h('section', { class: 'panel', 'aria-label': 'Semana' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Semana'), h('div', { class: 'row' }, legend())),
    h('div', { class: 'panel-body--scroll', style: { overflowX: 'auto' } }, cols)));

  if (connected) {
    view.append(h('p', { class: 'note' }, 'Calendários exibidos: ', (settings.google?.calendarIds || ['primary']).join(', '), '. Altere em Ajustes. ',
      h('button', { class: 'btn btn--sm btn--ghost', onclick: () => { gcal.disconnect(); ctx.clearEvents(); ctx.refresh(); } }, 'Desconectar')));
  }
}
