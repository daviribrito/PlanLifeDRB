import * as store from '../store.js';
import { h, icon, dateKey, fromKey, money, moneyCompact, parseMoney, uid, fmtShort, pct, nowISO } from '../util.js';
import { drawer, field, swatchPicker, guard, readOnlyNotice, stagger } from '../components.js';

export const TYPES = {
  reserva: ['Reserva de emergência', '#0E9F6E'],
  poupanca: ['Poupança', '#34B27B'],
  renda_fixa: ['Renda fixa', '#2563EB'],
  fundos: ['Fundos', '#0891B2'],
  acoes: ['Ações', '#7445D8'],
  fii: ['Fundos imobiliários', '#C026D3'],
  exterior: ['Exterior', '#4F46E5'],
  previdencia: ['Previdência', '#C99A06'],
  cripto: ['Cripto', '#E8833A'],
  conta: ['Conta corrente', '#64748B'],
  outro: ['Outro', '#94A3B8'],
};

export default async function render(view, ctx) {
  const [accounts, snaps, goals] = await Promise.all([store.items('finance/accounts'), store.items('finance/snapshots'), store.items('finance/goals')]);
  const can = store.canWrite();
  const total = accounts.reduce((a, x) => a + (Number(x.balance) || 0), 0);
  const invest = accounts.filter((a) => !['conta', 'reserva', 'poupanca'].includes(a.type)).reduce((a, x) => a + (Number(x.balance) || 0), 0);
  const reserve = accounts.filter((a) => ['reserva', 'poupanca'].includes(a.type)).reduce((a, x) => a + (Number(x.balance) || 0), 0);
  const history = monthlyHistory(accounts, snaps, 12);
  const prev = history.length > 1 ? history[history.length - 2].total : null;
  const delta = prev ? total - prev : null;

  ctx.header({
    title: 'Finanças',
    line: ['Poupança, investimentos e metas', 'Sem controle de gastos: só a visão de onde você está e para onde vai'],
    actions: can ? [
      h('button', { class: 'btn', onclick: () => editGoal(null) }, icon('target', 16), 'Nova meta'),
      h('button', { class: 'btn btn--primary', onclick: () => editAccount(null) }, icon('plus', 16), 'Nova conta'),
    ] : [],
  });
  view.append(readOnlyNotice() || '');

  // ---------- Patrimônio ----------
  const byType = {};
  accounts.forEach((a) => { byType[a.type] = (byType[a.type] || 0) + (Number(a.balance) || 0); });
  const types = Object.entries(byType).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  // Patrimônio como faixa: uma corrida por conta, no mesmo vocabulário da faixa de periodização
  const runs = [...accounts].filter((a) => a.balance > 0).sort((a, b) => b.balance - a.balance);
  const top = h('section', { class: 'panel', 'aria-label': 'Patrimônio' },
    h('div', { class: 'panel-head' },
      h('h2', null, total > 0 ? `${money(total)} acompanhados` : 'Nenhum saldo cadastrado'),
      delta !== null ? h('span', { class: `delta-chip ${delta >= 0 ? 'up' : 'down'}` }, `${delta >= 0 ? '+' : '−'}${money(Math.abs(delta))} desde o mês passado`) : null,
      total > 0 ? h('p', { style: { marginLeft: 'auto' } }, `Reserva e poupança ${money(reserve)} · investido ${money(invest)}`) : null),
    total > 0 ? h('div', { class: 'runs', role: 'list', 'aria-label': 'Distribuição por conta' }, runs.map((a) => {
      const share = a.balance / total;
      return h('div', { class: 'run', role: 'listitem', style: { flexGrow: share }, '--c': TYPES[a.type]?.[1] || '#94A3B8', title: `${a.name}: ${money(a.balance)}` },
        h('span', { class: 'run-bar' }),
        share > 0.12 ? h('span', { class: 'run-label' }, h('b', null, a.name), h('span', { class: 'num' }, `${moneyCompact(a.balance)} · ${pct(share)}`)) : null);
    })) : null,
    total > 0 && types.length > 1 ? h('div', { class: 'alloc-legend' }, types.map(([t, v]) => h('span', null, h('span', { class: 'dot', '--c': TYPES[t]?.[1] }), `${TYPES[t]?.[0] || t} ${pct(v / total)}`))) : null);

  // ---------- Contas + gráfico ----------
  const accPanel = h('section', { class: 'panel', 'aria-label': 'Contas e investimentos' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Contas e investimentos'), h('p', null, 'Atualize o saldo quando quiser; cada atualização entra no histórico.')));
  if (!accounts.length) {
    accPanel.append(h('div', { class: 'empty' }, h('h3', null, 'Cadastre onde seu dinheiro está'),
      h('p', null, 'Reserva de emergência, poupança, Tesouro, CDB, ações, previdência. Basta o nome, o tipo e o saldo de hoje.'),
      can ? h('button', { class: 'btn btn--primary', onclick: () => editAccount(null) }, icon('plus', 16), 'Nova conta') : null));
  } else {
    const rows = [...accounts].sort((a, b) => (b.balance || 0) - (a.balance || 0));
    accPanel.append(h('div', { class: 'panel-body--scroll' }, h('table', { class: 'table' },
      h('thead', null, h('tr', null, h('th', null, 'Conta'), h('th', null, 'Tipo'), h('th', { class: 'r' }, 'Saldo'), h('th', null, 'Atualizado'), h('th', { class: 'r' }, ''))),
      h('tbody', null, rows.map((a) => h('tr', null,
        h('td', null, h('b', null, a.name), a.institution ? h('div', { class: 'muted', style: { fontSize: '13px' } }, a.institution) : null),
        h('td', null, h('span', { class: 'chip', '--c': TYPES[a.type]?.[1] }, TYPES[a.type]?.[0] || a.type)),
        h('td', { class: 'r money' }, money(a.balance)),
        h('td', { class: 'muted' }, a.balanceDate ? fmtShort(fromKey(a.balanceDate)) : '—'),
        h('td', null, can ? h('div', { class: 'table-actions' },
          h('button', { class: 'btn btn--sm btn--ghost', onclick: () => updateBalance(a) }, 'Atualizar saldo'),
          h('button', { class: 'iconbtn', 'aria-label': `Editar ${a.name}`, onclick: () => editAccount(a) }, icon('edit', 16))) : null)))))));
  }
  const chartPanel = h('section', { class: 'panel', 'aria-label': 'Evolução' },
    h('div', { class: 'panel-head' }, h('h2', null, 'Evolução em 12 meses')),
    h('div', { class: 'panel-body' }, history.some((p) => p.total > 0) ? chart(history) : h('p', { class: 'muted' }, 'O gráfico aparece depois das primeiras atualizações de saldo.')));

  // ---------- Metas ----------
  const goalPanel = h('section', { class: 'panel', 'aria-label': 'Metas' },
    h('div', { class: 'panel-head' }, h('div', null, h('h2', null, 'Metas'), h('p', null, 'Progresso pelos saldos das contas ligadas a cada meta.')),
      can ? h('div', { class: 'row' }, h('button', { class: 'btn btn--sm', onclick: () => editGoal(null) }, icon('plus', 15), 'Nova meta')) : null));
  if (!goals.length) goalPanel.append(h('div', { class: 'empty' }, h('h3', null, 'Defina para onde o dinheiro vai'),
    h('p', null, 'Ex.: Reserva de 6 meses de custo, viagem em julho, entrada do apartamento. Ligue as contas que alimentam cada meta e veja se o aporte mensal fecha a conta.')));
  for (const g of goals) goalPanel.append(goalRow(g, accounts, () => can && editGoal(g)));
  top.classList.add('span-8'); chartPanel.classList.add('span-4'); accPanel.classList.add('span-7'); goalPanel.classList.add('span-5');
  view.append(stagger(h('div', { class: 'bento' }, top, chartPanel, accPanel, goalPanel)));

  // ---------- Formulários ----------
  function editAccount(a) {
    const isNew = !a;
    a = a || { id: uid('a-'), name: '', type: 'reserva', institution: '', balance: 0, notes: '' };
    const name = h('input', { class: 'input', value: a.name, placeholder: 'Ex.: Reserva no Tesouro Selic' });
    const type = h('select', { class: 'select' }, Object.entries(TYPES).map(([k, [l]]) => h('option', { value: k, selected: k === a.type }, l)));
    const inst = h('input', { class: 'input', value: a.institution || '', placeholder: 'Banco ou corretora (opcional)' });
    const bal = h('input', { class: 'input num', inputmode: 'decimal', value: isNew ? '' : String(a.balance).replace('.', ','), placeholder: '0,00', style: { fontSize: '18px' } });
    const notes = h('textarea', { class: 'textarea', placeholder: 'Opcional' }, a.notes || '');
    drawer({
      title: isNew ? 'Nova conta' : 'Editar conta',
      body: h('div', { class: 'stack' }, field('Nome', name), h('div', { class: 'grid-2' }, field('Tipo', type), field('Instituição', inst)), field('Saldo atual (R$)', bal), field('Notas', notes)),
      actions: [
        isNew ? null : (close) => h('button', { class: 'btn btn--danger', onclick: async () => { if (confirm(`Excluir “${a.name}” e o histórico de saldo dela?`)) { const ok = await guard(async () => { await store.remove('finance/accounts', a.id); const doc = await store.load('finance/snapshots'); doc.items = doc.items.filter((s) => s.accountId !== a.id); await store.save('finance/snapshots', doc); }, 'Conta excluída'); if (ok) { close(); ctx.refresh(); } } } }, icon('trash', 16), 'Excluir'),
        (close) => h('button', { class: 'btn btn--ghost', onclick: close }, 'Cancelar'),
        (close) => h('button', {
          class: 'btn btn--primary', onclick: async () => {
            if (!name.value.trim()) { name.focus(); return; }
            const balance = parseMoney(bal.value);
            const ok = await guard(async () => {
              await store.upsert('finance/accounts', { ...a, name: name.value.trim(), type: type.value, institution: inst.value.trim(), notes: notes.value.trim(), balance, balanceDate: dateKey() });
              if (isNew || balance !== a.balance) await snapshot(a.id, balance);
            }, isNew ? 'Conta criada' : 'Conta salva');
            if (ok) { close(); ctx.refresh(); }
          },
        }, isNew ? 'Criar conta' : 'Salvar'),
      ].filter(Boolean),
    });
  }

  function updateBalance(a) {
    const bal = h('input', { class: 'input num', inputmode: 'decimal', value: String(a.balance).replace('.', ','), style: { fontSize: '22px', height: '48px' } });
    const date = h('input', { class: 'input', type: 'date', value: dateKey() });
    drawer({
      title: `Saldo · ${a.name}`,
      body: h('div', { class: 'stack' }, h('p', { class: 'muted' }, `Último saldo: ${money(a.balance)}${a.balanceDate ? ' em ' + fmtShort(fromKey(a.balanceDate)) : ''}`), field('Novo saldo (R$)', bal), field('Data', date)),
      actions: [(close) => h('button', { class: 'btn btn--ghost', onclick: close }, 'Cancelar'), (close) => h('button', {
        class: 'btn btn--primary', onclick: async () => {
          const v = parseMoney(bal.value);
          const ok = await guard(async () => {
            if (date.value >= (a.balanceDate || '')) await store.upsert('finance/accounts', { id: a.id, balance: v, balanceDate: date.value });
            await snapshot(a.id, v, date.value);
          }, 'Saldo atualizado');
          if (ok) { close(); ctx.refresh(); }
        },
      }, 'Salvar saldo')],
    });
  }

  function editGoal(g) {
    const isNew = !g;
    g = g || { id: uid('g-'), name: '', target: 0, deadline: '', accountIds: [], monthly: 0, manualCurrent: 0, color: '#0E9F6E', notes: '' };
    const name = h('input', { class: 'input', value: g.name, placeholder: 'Ex.: Reserva de emergência de 6 meses' });
    const target = h('input', { class: 'input num', inputmode: 'decimal', value: g.target ? String(g.target).replace('.', ',') : '', placeholder: '0,00' });
    const deadline = h('input', { class: 'input', type: 'date', value: g.deadline || '' });
    const monthly = h('input', { class: 'input num', inputmode: 'decimal', value: g.monthly ? String(g.monthly).replace('.', ',') : '', placeholder: '0,00' });
    const manual = h('input', { class: 'input num', inputmode: 'decimal', value: g.manualCurrent ? String(g.manualCurrent).replace('.', ',') : '', placeholder: '0,00' });
    const color = swatchPicker(g.color);
    const set = new Set(g.accountIds || []);
    const accs = h('div', { class: 'stack', style: { gap: '6px' } }, accounts.length ? accounts.map((a) => {
      const cb = h('input', { type: 'checkbox', checked: set.has(a.id), id: `ga-${a.id}` });
      cb.addEventListener('change', () => cb.checked ? set.add(a.id) : set.delete(a.id));
      return h('label', { class: 'row', for: `ga-${a.id}` }, cb, `${a.name} · ${money(a.balance)}`);
    }) : h('p', { class: 'muted' }, 'Nenhuma conta cadastrada. Use o valor manual abaixo.'));
    drawer({
      title: isNew ? 'Nova meta' : 'Editar meta',
      body: h('div', { class: 'stack' },
        field('Nome', name), h('div', { class: 'grid-2' }, field('Valor alvo (R$)', target), field('Prazo', deadline)),
        field('Aporte mensal planejado (R$)', monthly, 'Usado para dizer se a meta está no ritmo.'),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Contas que contam para esta meta'), accs),
        field('Valor atual manual (R$)', manual, 'Só é usado se nenhuma conta estiver ligada.'),
        h('div', { class: 'field' }, h('span', { class: 'label' }, 'Cor'), color)),
      actions: [
        isNew ? null : (close) => h('button', { class: 'btn btn--danger', onclick: async () => { if (confirm(`Excluir a meta “${g.name}”?`) && await guard(() => store.remove('finance/goals', g.id), 'Meta excluída')) { close(); ctx.refresh(); } } }, icon('trash', 16), 'Excluir'),
        (close) => h('button', { class: 'btn btn--ghost', onclick: close }, 'Cancelar'),
        (close) => h('button', {
          class: 'btn btn--primary', onclick: async () => {
            if (!name.value.trim()) { name.focus(); return; }
            if (!(parseMoney(target.value) > 0)) { target.focus(); return; }
            const ok = await guard(() => store.upsert('finance/goals', { ...g, name: name.value.trim(), target: parseMoney(target.value), deadline: deadline.value || null, monthly: parseMoney(monthly.value), manualCurrent: parseMoney(manual.value), accountIds: [...set], color: color.value() }), isNew ? 'Meta criada' : 'Meta salva');
            if (ok) { close(); ctx.refresh(); }
          },
        }, isNew ? 'Criar meta' : 'Salvar'),
      ].filter(Boolean),
    });
  }
}

async function snapshot(accountId, balance, date = dateKey()) {
  const doc = await store.load('finance/snapshots');
  doc.items = doc.items.filter((s) => !(s.accountId === accountId && s.date === date));
  doc.items.push({ id: `${accountId}_${date}`, accountId, date, balance, createdAt: nowISO() });
  doc.items.sort((a, b) => a.date.localeCompare(b.date));
  await store.save('finance/snapshots', doc);
}

export function goalCurrent(g, accounts) {
  return g.accountIds?.length ? accounts.filter((a) => g.accountIds.includes(a.id)).reduce((s, a) => s + (Number(a.balance) || 0), 0) : Number(g.manualCurrent) || 0;
}

function goalRow(g, accounts, onEdit) {
  const cur = goalCurrent(g, accounts);
  const progress = Math.min(1, cur / (g.target || 1));
  const remaining = Math.max(0, g.target - cur);
  let paceEl = null, marker = null;
  if (g.deadline && remaining > 0) {
    const now = new Date(); const dl = fromKey(g.deadline);
    const months = Math.max(1, (dl.getFullYear() - now.getFullYear()) * 12 + dl.getMonth() - now.getMonth());
    const need = remaining / months;
    const ok = (g.monthly || 0) >= need;
    paceEl = h('span', { class: ok ? 'ok' : 'late' }, ok ? `No ritmo: precisa de ${money(need)}/mês` : `Abaixo do ritmo: precisa de ${money(need)}/mês, planejado ${money(g.monthly || 0)}`);
    const created = g.createdAt ? new Date(g.createdAt) : now;
    const span = dl - created;
    if (span > 0) marker = Math.min(1, Math.max(0, (now - created) / span));
  } else if (remaining <= 0) paceEl = h('span', { class: 'ok' }, 'Meta atingida');
  return h('article', { class: 'goal', '--c': g.color, style: { cursor: 'pointer' }, onclick: onEdit, tabindex: '0', onkeydown: (e) => e.key === 'Enter' && onEdit() },
    h('div', null, h('h3', null, h('span', { class: 'dot', '--c': g.color }), g.name)),
    h('div', { class: 'goal-nums' }, `${money(cur)} de ${moneyCompact(g.target)}`, h('small', null, `${pct(progress)}${g.deadline ? ' · prazo ' + fmtShort(fromKey(g.deadline)) : ''}`)),
    h('div', { class: 'goal-track', role: 'progressbar', 'aria-valuenow': Math.round(progress * 100), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': g.name },
      h('i', { style: { width: `${progress * 100}%` } }), marker !== null ? h('b', { style: { left: `${marker * 100}%` }, title: 'Onde deveria estar hoje' }) : null),
    h('div', { class: 'goal-foot' }, `Faltam ${money(remaining)}`, paceEl));
}

function monthlyHistory(accounts, snaps, n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const k = dateKey(end);
    let total = 0;
    for (const a of accounts) {
      const s = snaps.filter((x) => x.accountId === a.id && x.date <= k).pop();
      if (s) total += Number(s.balance) || 0;
    }
    out.push({ key: k, label: end.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), total });
  }
  // começa no primeiro mês com dado (mantém ao menos 2 pontos)
  const first = out.findIndex((p) => p.total > 0);
  return first > 0 ? out.slice(Math.min(first, out.length - 2)) : out;
}

function chart(points) {
  const W = 640, H = 220, pl = 8, pr = 8, pt = 14, pb = 26;
  const max = Math.max(...points.map((p) => p.total)) * 1.08 || 1;
  const x = (i) => pl + (i * (W - pl - pr)) / (points.length - 1);
  const y = (v) => pt + (1 - v / max) * (H - pt - pb);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${H - pb} L${x(0)},${H - pb} Z`;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'chart'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Patrimônio: ${points.map((p) => `${p.label} ${money(p.total)}`).join(', ')}`);
  const last = points[points.length - 1];
  svg.innerHTML = `
    ${[0.25, 0.5, 0.75, 1].map((f) => `<line x1="${pl}" x2="${W - pr}" y1="${y(max * f / 1.08)}" y2="${y(max * f / 1.08)}" stroke="var(--line)" stroke-dasharray="2 4"/>`).join('')}
    <path d="${area}" fill="color-mix(in oklab, var(--ok) 12%, transparent)"/>
    <path d="${line}" fill="none" stroke="var(--ok)" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(points.length - 1)}" cy="${y(last.total)}" r="4.5" fill="var(--surface)" stroke="var(--ok)" stroke-width="2.25"/>
    ${points.map((p, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}">${p.label}</text>`).join('')}
    <text x="${W - pr}" y="${Math.max(12, y(last.total) - 12)}" text-anchor="end" style="fill:var(--ink);font-weight:600;font-size:14px">${moneyCompact(last.total)}</text>`;
  return svg;
}
