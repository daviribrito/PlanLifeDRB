import * as store from '../store.js';
import * as ai from '../ai.js';
import * as gcal from '../gcal.js';
import { h, icon, dateKey, fromKey, addDays, fmtDayLong, fmtShort, nowISO, startOfWeek } from '../util.js';
import { modesById } from '../planning.js';
import { guard, modeChip, readOnlyNotice } from '../components.js';

const STATUS = { pending: 'pendente', accepted: 'aceita', done: 'feita', rejected: 'recusada', answered: 'respondida' };

/** Linha de sugestão/pergunta, usada em Hoje e no Assistente. */
export function suggestionRow(s, modes, { onChange, showDate = false } = {}) {
  const m = modes[s.modeId];
  const isQ = s.kind === 'question';
  const decide = (patch, msg) => guard(() => store.upsert('ai/suggestions', { id: s.id, decidedAt: nowISO(), ...patch }), msg).then((ok) => ok && onChange?.());
  const when = s.start ? `${s.start} · ${s.durationMin} min` : isQ ? null : `${s.durationMin} min · sem horário`;
  const meta = h('div', { class: 'sugg-meta' },
    modeChip(m),
    showDate ? h('span', null, fmtShort(fromKey(s.date))) : null,
    when ? h('span', { class: 'num' }, when) : null,
    s.status !== 'pending' ? h('span', { class: 'sugg-status', 'data-s': s.status }, STATUS[s.status]) : null,
    s.source?.model ? h('span', null, s.source.provider === 'ideias' ? 'ideia do ciclo' : s.source.model) : null);

  const row = h('article', { class: `sugg${isQ ? ' is-question' : ''}` },
    h('div', { class: 'sugg-title' }, isQ ? icon('question', 17) : null, h('span', null, s.title)));
  const actions = h('div', { class: 'sugg-actions' });
  const can = store.canWrite();

  if (!isQ && s.status === 'pending' && can) {
    actions.append(
      h('button', { class: 'btn btn--sm btn--ghost', onclick: () => decide({ status: 'rejected' }, 'Recusada') }, icon('x', 15), 'Recusar'),
      h('button', { class: 'btn btn--sm btn--primary', onclick: () => decide({ status: 'accepted' }, 'Aceita. Ela entra no seu dia, a rotina segue igual.') }, icon('check', 15), 'Aceitar'));
    if (s.start && gcal.isConnected()) actions.append(h('button', {
      class: 'iconbtn', title: 'Aceitar e criar evento no Google Agenda', 'aria-label': 'Aceitar e criar evento no Google Agenda',
      onclick: async () => { const ok = await guard(() => gcal.createEvent(s)); if (ok) decide({ status: 'accepted', calendar: true }, 'Aceita e enviada ao Google Agenda'); },
    }, icon('calendar', 16)));
  } else if (!isQ && ['accepted', 'done'].includes(s.status) && can) {
    actions.append(s.status === 'done'
      ? h('button', { class: 'btn btn--sm btn--ghost', onclick: () => decide({ status: 'accepted' }) }, 'Desfazer')
      : h('button', { class: 'btn btn--sm', onclick: () => decide({ status: 'done' }, 'Feito') }, icon('check', 15), 'Concluir'));
  } else if (s.status === 'rejected' && can) {
    actions.append(h('button', { class: 'btn btn--sm btn--ghost', onclick: () => decide({ status: 'pending' }) }, 'Reconsiderar'));
  }
  row.append(actions);
  if (s.detail) row.append(h('p', { class: 'sugg-detail' }, s.detail));
  row.append(meta);

  if (isQ) {
    if (s.answer) row.append(h('p', { class: 'sugg-detail' }, h('b', null, 'Sua resposta: '), s.answer));
    else if (can && s.status === 'pending') {
      const ta = h('textarea', { class: 'textarea', placeholder: 'Responda com suas palavras. A IA usa isso nas próximas sugestões.', 'aria-label': `Resposta: ${s.title}` });
      row.append(h('div', { class: 'sugg-answer' }, ta,
        h('div', { class: 'stack', style: { gap: '6px' } },
          h('button', { class: 'btn btn--sm btn--primary', onclick: () => { if (ta.value.trim()) decide({ status: 'answered', answer: ta.value.trim() }, 'Resposta salva'); else ta.focus(); } }, 'Responder'),
          h('button', { class: 'btn btn--sm btn--ghost', onclick: () => decide({ status: 'rejected' }) }, 'Ignorar'))));
    }
  }
  return row;
}

export default async function render(view, ctx) {
  const [modes, all, cfg, ready] = await Promise.all([modesById(), store.items('ai/suggestions'), ai.config(), ai.isReady()]);
  let range = 'today', filter = ctx.params.get('f') || 'pending';

  const note = h('input', { class: 'input', placeholder: 'Pedido extra (opcional): ex. "hoje estou cansado, nada intenso"', 'aria-label': 'Pedido extra para a IA' });
  const rangeSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Período' }, [['today', 'Hoje'], ['3', '3 dias'], ['week', 'Semana']].map(([v, l]) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(v === range) }, l);
    b.addEventListener('click', () => { range = v; rangeSeg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
    return b;
  }));
  const gen = h('button', { class: 'btn btn--mode' }, icon('spark', 16), 'Gerar sugestões');
  gen.addEventListener('click', async () => {
    if (!ready) { ctx.go('#/ajustes'); return; }
    const today = new Date();
    const keys = range === 'today' ? [dateKey(today)] : range === '3' ? ai.nextDays(3) : Array.from({ length: 7 }, (_, i) => dateKey(addDays(startOfWeek(today), i))).filter((k) => k >= dateKey(today));
    gen.classList.add('is-busy');
    const events = await ctx.events(addDays(today, -1), addDays(today, 8));
    const ok = await guard(() => ai.suggest(keys, { events, note: note.value.trim() }), 'Sugestões prontas');
    gen.classList.remove('is-busy');
    if (ok) ctx.refresh();
  });

  ctx.header({
    title: 'Assistente',
    line: [ready ? `${ai.PROVIDERS[cfg.provider]?.label || cfg.provider} · ${cfg.model}` : h('a', { href: '#/ajustes' }, 'Configure um provedor de IA em Ajustes'), 'Sugere extras e faz perguntas. Nunca altera a rotina principal.'],
  });
  view.append(readOnlyNotice() || '');

  view.append(h('section', { class: 'panel', 'aria-label': 'Pedir sugestões' },
    h('div', { class: 'panel-body row', style: { gap: '12px' } }, rangeSeg, h('div', { style: { flex: '1', minWidth: '260px' } }, note), gen)));

  const counts = {
    pending: all.filter((s) => s.status === 'pending').length,
    accepted: all.filter((s) => ['accepted', 'done'].includes(s.status)).length,
    question: all.filter((s) => s.kind === 'question').length,
    rejected: all.filter((s) => s.status === 'rejected').length,
  };
  const listHost = h('div');
  const filterSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Filtro' }, [['pending', 'Pendentes'], ['accepted', 'Aceitas'], ['question', 'Perguntas'], ['rejected', 'Recusadas']].map(([v, l]) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(v === filter) }, `${l} ${counts[v]}`);
    b.addEventListener('click', () => { filter = v; filterSeg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); });
    return b;
  }));

  function draw() {
    listHost.replaceChildren();
    const pick = {
      pending: (s) => s.status === 'pending',
      accepted: (s) => ['accepted', 'done'].includes(s.status),
      question: (s) => s.kind === 'question',
      rejected: (s) => s.status === 'rejected',
    }[filter];
    const list = all.filter(pick).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (!list.length) {
      listHost.append(h('div', { class: 'empty' }, h('h3', null, {
        pending: 'Nenhuma sugestão esperando decisão', accepted: 'Você ainda não aceitou sugestões', question: 'A IA ainda não fez perguntas', rejected: 'Nada recusado',
      }[filter]), h('p', null, filter === 'pending' ? 'Escolha um período acima e gere sugestões. Elas consideram seus ciclos de foco, a rotina, a agenda e o que você já aceitou ou recusou.' : 'Elas aparecem aqui conforme você usa o assistente.')));
      return;
    }
    let lastDate = null;
    for (const s of list) {
      if (s.date !== lastDate) {
        lastDate = s.date;
        listHost.append(h('div', { style: { padding: '12px 18px 4px', font: '600 14px/1 var(--cond)', color: 'var(--muted)', borderTop: '1px solid var(--line)' } }, fmtDayLong(fromKey(s.date))));
      }
      listHost.append(suggestionRow(s, modes, { onChange: () => ctx.refresh() }));
    }
  }
  draw();
  view.append(h('section', { class: 'panel', 'aria-label': 'Histórico de sugestões' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Sugestões e perguntas'), h('div', { class: 'row' }, filterSeg)), listHost));
}
