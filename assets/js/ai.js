// IA integrada, agnóstica de provedor. A chave de API fica só neste navegador (localStorage),
// nunca vai para os arquivos do repositório.

import * as store from './store.js';
import { isOpen, getAIKey, setAIKey } from './session.js';
import { getSettings, modesById, cyclesOn, dayItems, freeWindows } from './planning.js';
import { addDays, dateKey, fromKey, fmtDayLong, toHHMM, uid, WEEKDAYS_LONG, isoWeekday, money } from './util.js';

export const PROVIDERS = {
  anthropic: { label: 'Anthropic (Claude)', model: 'claude-sonnet-5-5', keyHint: 'sk-ant-…' },
  openai: { label: 'OpenAI', model: 'gpt-5-mini', keyHint: 'sk-…' },
  google: { label: 'Google (Gemini)', model: 'gemini-2.5-flash', keyHint: 'AIza…' },
  compatible: { label: 'Compatível com OpenAI (OpenRouter, Ollama, Groq…)', model: '', keyHint: 'opcional para Ollama' },
};

const KEY_PREFIX = 'planlife.ai.key.';
export const getKey = (provider) => { if (getAIKey(provider)) return getAIKey(provider); try { return localStorage.getItem(KEY_PREFIX + provider) || ''; } catch { return ''; } };
// Com sessão aberta, a chave vai cifrada para o cofre (acompanha você em qualquer PC); sem sessão, fica neste navegador.
export const setKey = async (provider, key) => {
  if (isOpen() && store.canWrite()) { await setAIKey(provider, key); try { localStorage.removeItem(KEY_PREFIX + provider); } catch { } return; }
  try { key ? localStorage.setItem(KEY_PREFIX + provider, key) : localStorage.removeItem(KEY_PREFIX + provider); } catch { }
};

export async function config() {
  const s = await getSettings();
  const provider = s.ai?.provider || 'anthropic';
  return { provider, model: s.ai?.model || PROVIDERS[provider]?.model, baseUrl: s.ai?.baseUrl || '', key: getKey(provider) };
}
export async function isReady() {
  const c = await config();
  return !!(c.model && (c.key || c.provider === 'compatible'));
}

async function call({ system, user, maxTokens = 2000 }) {
  const c = await config();
  if (!c.model) throw new Error('Defina o modelo de IA em Ajustes.');
  if (!c.key && c.provider !== 'compatible') throw new Error('Adicione sua chave de API em Ajustes.');
  let res, data;
  if (c.provider === 'anthropic') {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': c.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: c.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Erro ${res.status}`);
    return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  }
  if (c.provider === 'google') {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': c.key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { responseMimeType: 'application/json' } }),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Erro ${res.status}`);
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  }
  const base = c.provider === 'openai' ? 'https://api.openai.com/v1' : (c.baseUrl || '').replace(/\/$/, '');
  if (!base) throw new Error('Informe a URL base do provedor compatível em Ajustes.');
  res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(c.key ? { authorization: `Bearer ${c.key}` } : {}) },
    body: JSON.stringify({ model: c.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], response_format: { type: 'json_object' } }),
  });
  data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Erro ${res.status}`);
  return data.choices?.[0]?.message?.content || '';
}

function parseJSON(text) {
  try { return JSON.parse(text); } catch { }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) try { return JSON.parse(m[0]); } catch { }
  throw new Error('A IA respondeu num formato inesperado. Tente de novo.');
}

export async function testConnection() {
  const out = await call({ system: 'Responda apenas com JSON.', user: 'Responda {"ok": true}', maxTokens: 50 });
  return parseJSON(out).ok === true;
}

const SYSTEM = `Você é o assistente do PlanLife, um sistema pessoal de gestão de vida.
Regras inegociáveis:
- A rotina principal do usuário NUNCA muda. Você só sugere extras viáveis que caibam nas janelas livres informadas.
- Cada sugestão precisa servir ao ciclo de foco ativo naquele dia e ser concreta, curta e realizável.
- Não repita sugestões recusadas recentemente; aprenda com as aceitas.
- Você pode fazer PERGUNTAS ao usuário (kind "question") quando precisar de informação para ajudar melhor (ex.: hábitos de gasto, nível de inglês). No máximo 2 perguntas por pedido, e não repita perguntas já respondidas.
- Não dê recomendações de investimento específicas (ativos, corretoras). Foque em organização e hábitos.
- Escreva em português do Brasil, frases curtas, sem emojis.
Responda SOMENTE com JSON no formato:
{"suggestions":[{"date":"YYYY-MM-DD","kind":"task","modeId":"...","title":"até 60 caracteres","detail":"1 ou 2 frases explicando o porquê","start":"HH:MM ou null","durationMin":30},
 {"date":"YYYY-MM-DD","kind":"question","modeId":"...","title":"a pergunta","detail":"por que você quer saber"}]}`;

/** Monta o contexto e pede sugestões para os dias informados. */
export async function suggest(dayKeys, { events = [], note = '' } = {}) {
  const [settings, modes, cycles, sugg, accounts, goals] = await Promise.all([
    getSettings(), modesById(), store.items('focus/cycles'), store.items('ai/suggestions'),
    store.items('finance/accounts'), store.items('finance/goals'),
  ]);
  const days = [];
  const focusIds = new Set();
  for (const key of dayKeys) {
    const cyc = cyclesOn(key, cycles);
    cyc.forEach((c) => focusIds.add(c.modeId));
    const items = await dayItems(key, { events });
    const isToday = key === dateKey();
    const nowMin = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : null;
    days.push({
      date: key,
      weekday: WEEKDAYS_LONG[isoWeekday(fromKey(key)) - 1],
      focus: cyc.map((c) => ({ modeId: c.modeId, mode: modes[c.modeId]?.name, goal: c.goal || '' })),
      commitments: items.map((i) => `${toHHMM(i.start)}-${toHHMM(i.end)} ${i.title}${i.type === 'event' ? ' (agenda)' : ''}`),
      freeWindows: freeWindows(items, settings, 20, nowMin).map((w) => `${toHHMM(w.start)}-${toHHMM(w.end)}`),
    });
  }
  const modeInfo = [...focusIds].map((id) => modes[id]).filter(Boolean).map((m) => ({ id: m.id, name: m.name, brief: m.aiBrief }));
  const recent = sugg.slice(-60);
  const ctx = {
    today: dateKey(),
    user: settings.profile?.name || '',
    modes: modeInfo,
    days,
    accepted: recent.filter((s) => ['accepted', 'done'].includes(s.status) && s.kind === 'task').map((s) => s.title).slice(-15),
    rejected: recent.filter((s) => s.status === 'rejected').map((s) => s.title).slice(-15),
    answeredQuestions: sugg.filter((s) => s.kind === 'question' && s.answer).map((s) => ({ q: s.title, a: s.answer })).slice(-12),
    openQuestions: sugg.filter((s) => s.kind === 'question' && !s.answer && s.status === 'pending').map((s) => s.title),
  };
  if (focusIds.has('m-financas') || [...focusIds].some((id) => /finan/i.test(modes[id]?.name || ''))) {
    ctx.finance = {
      accounts: accounts.map((a) => ({ name: a.name, type: a.type, balance: money(a.balance) })),
      goals: goals.map((g) => ({ name: g.name, target: money(g.target), deadline: g.deadline })),
    };
  }
  if (!modeInfo.length) throw new Error('Nenhum ciclo de foco ativo nesses dias. Crie um ciclo em Ciclos.');
  const user = `Contexto:\n${JSON.stringify(ctx, null, 1)}\n\n${note ? `Pedido extra do usuário: ${note}\n\n` : ''}Gere de 3 a 6 sugestões no total para esses dias.`;
  const out = parseJSON(await call({ system: SYSTEM, user }));
  const c = await config();
  const valid = new Set(dayKeys);
  const list = (out.suggestions || [])
    .filter((s) => s && s.title && valid.has(s.date))
    .map((s) => ({
      id: uid('s-'),
      date: s.date,
      kind: s.kind === 'question' ? 'question' : 'task',
      modeId: modes[s.modeId] ? s.modeId : [...focusIds][0],
      title: String(s.title).slice(0, 120),
      detail: String(s.detail || '').slice(0, 400),
      start: /^\d{2}:\d{2}$/.test(s.start || '') ? s.start : null,
      durationMin: Math.min(240, Math.max(5, Number(s.durationMin) || 30)),
      status: 'pending',
      answer: null,
      source: { provider: c.provider, model: c.model },
    }));
  if (!list.length) throw new Error('A IA não trouxe sugestões válidas. Tente de novo.');
  await store.upsertMany('ai/suggestions', list);
  return list;
}

export const nextDays = (n, from = new Date()) => Array.from({ length: n }, (_, i) => dateKey(addDays(from, i)));
export { fmtDayLong };
