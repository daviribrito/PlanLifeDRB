// Regras de domínio: ciclos de foco, agenda do dia, tempo livre.

import * as store from './store.js';
import { dateKey, fromKey, isoWeekday, toMin, monthKey, addDays } from './util.js';

export const KIND_LABEL = { month: 'Mês', week: 'Semana', custom: 'Dias' };
export const KIND_RANK = { custom: 3, week: 2, month: 1 }; // mais específico vence

export async function getSettings() {
  const s = await store.load('settings', null);
  return s || { schema: 'planlife.settings', version: 1, profile: { name: '' }, day: { start: '06:00', end: '23:00' }, weekStart: 1, ai: { provider: 'anthropic', model: '', baseUrl: '' }, google: { clientId: '', calendarIds: ['primary'] } };
}

export async function modesById() {
  const list = await store.items('focus/modes');
  return Object.fromEntries(list.map((m) => [m.id, m]));
}

/** Ciclos que valem num dia, do mais específico para o mais amplo. */
export function cyclesOn(key, cycles) {
  const wd = isoWeekday(fromKey(key));
  return cycles
    .filter((c) => c.startDate <= key && key <= c.endDate && (!c.weekdays || !c.weekdays.length || c.weekdays.includes(wd)))
    .sort((a, b) => (KIND_RANK[b.kind] || 0) - (KIND_RANK[a.kind] || 0));
}

/** Posição do dia dentro do ciclo, contando só os dias em que ele vale. */
export function cycleProgress(c, key) {
  let total = 0, idx = 0;
  for (let d = fromKey(c.startDate); dateKey(d) <= c.endDate; d = addDays(d, 1)) {
    if (c.weekdays?.length && !c.weekdays.includes(isoWeekday(d))) continue;
    total++;
    if (dateKey(d) <= key) idx = total;
  }
  return { idx, total };
}

export async function logsFor(key) {
  const doc = await store.load(`routine/logs/${key.slice(0, 7)}`);
  return doc.items.filter((l) => l.date === key);
}

export async function setBlockStatus(key, blockId, status) {
  const path = `routine/logs/${key.slice(0, 7)}`;
  const doc = await store.load(path);
  const id = `${key}_${blockId}`;
  doc.items = doc.items.filter((l) => l.id !== id);
  if (status) doc.items.push({ id, date: key, blockId, status, at: new Date().toISOString() });
  await store.save(path, doc);
}

/** Itens do dia: blocos da rotina + sugestões aceitas com horário + eventos do Google (se carregados). */
export async function dayItems(key, { events = [] } = {}) {
  const wd = isoWeekday(fromKey(key));
  const [blocks, logs, sugg, modes] = await Promise.all([
    store.items('routine/blocks'), logsFor(key), store.items('ai/suggestions'), modesById(),
  ]);
  const st = Object.fromEntries(logs.map((l) => [l.blockId, l.status]));
  const out = [];
  for (const b of blocks) {
    if (b.active === false || !b.weekdays?.includes(wd)) continue;
    out.push({ type: 'routine', id: b.id, title: b.title, start: toMin(b.start), end: toMin(b.end), mode: modes[b.modeId], status: st[b.id] || 'pending', ref: b });
  }
  for (const s of sugg) {
    if (s.date !== key || !['accepted', 'done'].includes(s.status) || !s.start) continue;
    const start = toMin(s.start);
    out.push({ type: 'suggestion', id: s.id, title: s.title, start, end: start + (s.durationMin || 30), mode: modes[s.modeId], status: s.status === 'done' ? 'done' : 'pending', ref: s });
  }
  for (const e of events) {
    if (e.allDay || e.dateKey !== key) continue;
    out.push({ type: 'event', id: e.id, title: e.title, start: e.startMin, end: e.endMin, status: 'event', ref: e });
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Janelas livres do dia (>= minGap minutos) dentro do horário acordado. */
export function freeWindows(items, settings, minGap = 15, fromMin = null) {
  let cursor = Math.max(toMin(settings.day?.start || '06:00'), fromMin ?? 0);
  const end = toMin(settings.day?.end || '23:00');
  const busy = items.map((i) => [i.start, i.end]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [s, e] of busy) {
    if (s - cursor >= minGap) out.push({ start: cursor, end: Math.min(s, end) });
    cursor = Math.max(cursor, e);
    if (cursor >= end) break;
  }
  if (end - cursor >= minGap) out.push({ start: cursor, end });
  return out.filter((w) => w.end - w.start >= minGap);
}

/** Distribui itens sobrepostos em colunas (para a linha do tempo). */
export function layoutColumns(items) {
  const cols = [];
  const placed = [];
  for (const it of items) {
    let c = cols.findIndex((endAt) => endAt <= it.start);
    if (c === -1) { c = cols.length; cols.push(it.end); } else cols[c] = it.end;
    placed.push({ ...it, col: c });
  }
  // largura por grupo de sobreposição
  for (const p of placed) {
    const overl = placed.filter((q) => q.start < p.end && p.start < q.end);
    p.cols = Math.max(...overl.map((q) => q.col)) + 1;
  }
  return placed;
}

export const currentMonthKey = () => monthKey(new Date());
