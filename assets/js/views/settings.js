import * as store from '../store.js';
import * as ai from '../ai.js';
import * as gcal from '../gcal.js';
import { h, icon, download, dateKey } from '../util.js';
import { getSettings } from '../planning.js';
import { field, guard, readOnlyNotice } from '../components.js';
import { session, isOpen, setGitHub } from '../session.js';

export default async function render(view, ctx) {
  const s = await getSettings();
  const can = store.canWrite();
  ctx.header({ title: 'Ajustes', line: ['PlanLife 2.0', { local: 'Servidor local · gravando em data/', github: 'Web · gravando no GitHub', readonly: 'Somente leitura' }[store.getMode()]] });
  view.append(readOnlyNotice() || '');

  const saveSettings = (patch, msg = 'Ajustes salvos') => guard(async () => {
    const doc = await store.load('settings', null) || { ...s };
    Object.assign(doc, patch);
    await store.save('settings', doc);
  }, msg);

  const panel = h('section', { class: 'panel' });

  // ---------- Perfil e dia ----------
  const name = h('input', { class: 'input', value: s.profile?.name || '' });
  const dStart = h('input', { class: 'input', type: 'time', value: s.day?.start || '06:00' });
  const dEnd = h('input', { class: 'input', type: 'time', value: s.day?.end || '23:00' });
  panel.append(h('div', { class: 'settings-grid' },
    h('div', null, h('h3', null, 'Você e seu dia'), h('p', null, 'O horário acordado define as janelas livres que a IA pode usar.')),
    h('div', { class: 'stack' }, field('Nome', name), h('div', { class: 'grid-2' }, field('Acordado a partir de', dStart), field('Até', dEnd)),
      can ? h('div', null, h('button', { class: 'btn btn--primary', onclick: () => saveSettings({ profile: { ...s.profile, name: name.value.trim() }, day: { start: dStart.value, end: dEnd.value } }) }, 'Salvar')) : null)));

  // ---------- IA ----------
  const prov = h('select', { class: 'select' }, Object.entries(ai.PROVIDERS).map(([k, p]) => h('option', { value: k, selected: k === (s.ai?.provider || 'anthropic') }, p.label)));
  const model = h('input', { class: 'input input--mono', value: s.ai?.model || ai.PROVIDERS[s.ai?.provider || 'anthropic'].model });
  const key = h('input', { class: 'input input--mono', type: 'password', autocomplete: 'off', value: ai.getKey(prov.value), placeholder: ai.PROVIDERS[prov.value].keyHint });
  const base = h('input', { class: 'input input--mono', value: s.ai?.baseUrl || '', placeholder: 'https://openrouter.ai/api/v1  ou  http://localhost:11434/v1' });
  const baseField = field('URL base', base, 'Só para provedores compatíveis com a API da OpenAI.');
  const syncProv = () => {
    key.value = ai.getKey(prov.value); key.placeholder = ai.PROVIDERS[prov.value].keyHint;
    if (!model.value || Object.values(ai.PROVIDERS).some((p) => p.model === model.value)) model.value = ai.PROVIDERS[prov.value].model;
    baseField.style.display = prov.value === 'compatible' ? '' : 'none';
  };
  prov.addEventListener('change', syncProv); baseField.style.display = prov.value === 'compatible' ? '' : 'none';
  const test = h('button', { class: 'btn' }, 'Testar conexão');
  test.addEventListener('click', async () => {
    await guard(() => ai.setKey(prov.value, key.value.trim()));
    if (can) await saveSettings({ ai: { provider: prov.value, model: model.value.trim(), baseUrl: base.value.trim() } }, null);
    test.classList.add('is-busy');
    await guard(() => ai.testConnection(), 'Conexão funcionando');
    test.classList.remove('is-busy');
  });
  panel.append(h('div', { class: 'settings-grid' },
    h('div', null, h('h3', null, 'Inteligência artificial'), h('p', null, 'Escolha o provedor. Com a sessão aberta, a chave fica guardada cifrada dentro do cofre e vale em qualquer PC ou na web.')),
    h('div', { class: 'stack' }, field('Provedor', prov), field('Modelo', model, 'Você pode trocar por qualquer modelo disponível na sua conta.'), field('Chave de API', key), baseField,
      h('div', { class: 'row' }, h('button', {
        class: 'btn btn--primary', onclick: async () => {
          await guard(() => ai.setKey(prov.value, key.value.trim()));
          if (can) await saveSettings({ ai: { provider: prov.value, model: model.value.trim(), baseUrl: base.value.trim() } });
          else toast('Chave salva neste navegador.');
          ctx.refreshChrome();
        },
      }, 'Salvar'), test))));

  // ---------- Google ----------
  const client = h('input', { class: 'input input--mono', value: s.google?.clientId || '', placeholder: '1234567890-abc.apps.googleusercontent.com' });
  const calIds = h('input', { class: 'input input--mono', value: (s.google?.calendarIds || ['primary']).join(', ') });
  const calList = h('div', { class: 'stack', style: { gap: '6px' } });
  const connected = gcal.isConnected();
  if (connected) {
    gcal.listCalendars().then((cals) => {
      const sel = new Set((s.google?.calendarIds || ['primary']));
      calList.append(h('span', { class: 'label' }, 'Calendários para exibir'), ...cals.map((c) => {
        const id = c.primary ? 'primary' : c.id;
        const cb = h('input', { type: 'checkbox', checked: sel.has(id), id: `cal-${btoa(c.id).slice(0, 10)}` });
        cb.addEventListener('change', () => { cb.checked ? sel.add(id) : sel.delete(id); calIds.value = [...sel].join(', '); });
        return h('label', { class: 'row', for: cb.id }, cb, h('span', { class: 'dot', '--c': c.color }), c.name);
      }));
    }).catch(() => { });
  }
  panel.append(h('div', { class: 'settings-grid' },
    h('div', null, h('h3', null, 'Google Agenda'), h('p', null, 'Crie um Client ID OAuth (tipo Aplicativo da Web) no Google Cloud e autorize as origens http://localhost:3100 e a do seu GitHub Pages. Passo a passo no README.')),
    h('div', { class: 'stack' }, field('Client ID', client), field('IDs dos calendários', calIds, 'Separados por vírgula. “primary” é o seu calendário principal.'), calList,
      h('div', { class: 'row' },
        can ? h('button', { class: 'btn btn--primary', onclick: async () => { await saveSettings({ google: { clientId: client.value.trim(), calendarIds: calIds.value.split(',').map((x) => x.trim()).filter(Boolean) } }); ctx.clearEvents(); } }, 'Salvar') : null,
        connected ? h('span', { class: 'status-ok' }, icon('check', 14), 'Conectado nesta sessão') : h('button', { class: 'btn', onclick: async () => { if (await guard(() => gcal.connect(), 'Google Agenda conectada')) ctx.refresh(); } }, 'Conectar')))));

  // ---------- Uso pela web (GitHub) ----------
  if (isOpen()) {
    const cur = session.data.integrations?.github || {};
    const owner = h('input', { class: 'input input--mono', value: cur.owner || 'daviribrito' });
    const repo = h('input', { class: 'input input--mono', value: cur.repo || 'PlanLifeDRB' });
    const branch = h('input', { class: 'input input--mono', value: cur.branch || 'main' });
    const token = h('input', { class: 'input input--mono', type: 'password', autocomplete: 'off', value: cur.token || '', placeholder: 'github_pat_…' });
    const status = h('span', { class: cur.token ? 'status-ok' : 'status-off' }, cur.token ? [icon('check', 14), 'Configurado'] : 'Não configurado');
    const testGh = async (cfg) => {
      const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`, { headers: { authorization: `Bearer ${cfg.token}`, accept: 'application/vnd.github+json' } });
      if (r.status === 401) throw new Error('Token inválido.');
      if (r.status === 404) throw new Error('Repositório não encontrado ou o token não tem acesso a ele.');
      const j = await r.json();
      if (!j.permissions?.push) throw new Error('O token só lê o repositório. Dê permissão “Contents: Read and write”.');
      return j;
    };
    const saveGh = h('button', { class: 'btn btn--primary' }, 'Salvar e testar');
    saveGh.addEventListener('click', async () => {
      const cfg = { owner: owner.value.trim(), repo: repo.value.trim(), branch: branch.value.trim() || 'main', token: token.value.trim() };
      if (!cfg.token) { token.focus(); return; }
      saveGh.classList.add('is-busy');
      const ok = await guard(async () => {
        const info = await testGh(cfg);
        await setGitHub(cfg); // na web, a própria gravação do cofre já vai pela API
        return info;
      }, 'GitHub conectado. Na web, cada alteração agora é salva no repositório.');
      saveGh.classList.remove('is-busy');
      if (ok) ctx.refresh();
    });
    panel.append(h('div', { class: 'settings-grid' },
      h('div', null, h('h3', null, 'Usar e salvar pela web'), h('p', null, 'No GitHub Pages, o app salva direto no repositório pela API do GitHub: cada alteração vira um commit. O token fica cifrado dentro do cofre.')),
      h('div', { class: 'stack' },
        h('div', { class: 'grid-3' }, field('Usuário ou organização', owner), field('Repositório', repo), field('Branch', branch)),
        field('Token do GitHub', token, 'Crie em GitHub → Settings → Developer settings → Fine-grained tokens, só para este repositório, com permissão “Contents: Read and write”.'),
        h('div', { class: 'row' }, saveGh, cur.token ? h('button', { class: 'btn btn--ghost', onclick: async () => { if (confirm('Remover o token do GitHub do cofre? Na web o app volta a ser só leitura.') && await guard(() => setGitHub(null), 'Token removido')) ctx.refresh(); } }, 'Remover token') : null, status),
        h('p', { class: 'note' }, h('b', null, 'Agora: '), { local: 'você está no PC, gravando na pasta data/. Faça commit e push para levar as mudanças para a web.', github: 'você está na web, gravando direto no GitHub.', readonly: 'somente leitura. Salve um token acima para poder editar pela web.' }[store.getMode()]))));
  }

  // ---------- Dados ----------
  panel.append(h('div', { class: 'settings-grid' },
    h('div', null, h('h3', null, 'Dados e migração'), h('p', null, 'Tudo vive em arquivos JSON na pasta data/, um por coleção, com schema e versão. A estrutura está documentada em docs/DATA.md junto com um SQL pronto para migrar.')),
    h('div', { class: 'stack' },
      h('p', { class: 'note' }, h('b', null, 'Fluxo diário: '), 'edite aqui com start.cmd rodando, depois faça commit e push. Em outro PC, git pull e start.cmd. O GitHub Pages mostra a versão publicada em modo leitura.'),
      h('p', { class: 'note' }, h('b', null, 'Atenção: '), store.isEncrypted() ? 'todos os arquivos de data/ são cifrados com a sua Chave Mestra. O repositório pode ser público sem expor seus dados; a exportação abaixo gera um arquivo decifrado, guarde-o com cuidado.' : 'crie o cofre para ativar o login e cifrar todos os dados. Até lá, quem abrir o repositório lê os arquivos.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async () => { const b = await store.exportBundle(); download(`planlife-export-${dateKey()}.json`, JSON.stringify(b, null, 2)); } }, icon('download', 16), 'Exportar tudo decifrado (JSON único)')))));

  view.append(panel);
}

function toast(m) { import('../util.js').then((u) => u.toast(m)); }
