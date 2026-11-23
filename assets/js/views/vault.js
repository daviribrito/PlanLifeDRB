// Cofre de senhas: Chave Mestra (PBKDF2 → AES-256-GCM) + 2FA TOTP.
// O arquivo data/vault/vault.enc.json só contém dados cifrados.

import * as store from '../store.js';
import * as C from '../crypto.js';
import { h, icon, clear, uid, nowISO, copyText, toast, fmtShort } from '../util.js';
import { drawer, field, guard } from '../components.js';
import { parseImport, dupKey } from '../vault-import.js';
import { session, touch, lock, persist, open as openSession, PATH, AAD } from '../session.js';

let qrLoading = null;
function loadQr() {
  if (window.qrcode) return Promise.resolve();
  if (!qrLoading) qrLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    s.onload = res; s.onerror = () => rej(new Error('QR indisponível'));
    document.head.append(s);
  });
  return qrLoading;
}
async function qrSvg(text) {
  try {
    await loadQr();
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    return h('div', { class: 'qr', html: q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }) });
  } catch { return h('p', { class: 'note' }, 'Não foi possível desenhar o QR code. Use a chave abaixo no app autenticador.'); }
}

export default async function render(view, ctx) {
  store.invalidate(PATH);
  const file = await store.load(PATH, null);
  const header = (line) => ctx.header({
    title: 'Cofre de senhas',
    line: [session.key ? h('span', null, icon('shield', 14), 'AES-256-GCM · PBKDF2 600 mil iterações · 2FA TOTP') : null, line],
    actions: session.key ? [
      h('button', { class: 'btn btn--ghost', onclick: () => openGenerator() }, icon('dice', 16), 'Gerador'),
      store.canWrite() ? h('button', { class: 'btn btn--ghost', onclick: () => openImport() }, icon('upload', 16), 'Importar') : null,
      store.canWrite() ? h('button', { class: 'btn', onclick: () => editEntry(null) }, icon('plus', 16), 'Nova senha') : null,
      h('button', { class: 'btn btn--primary', onclick: () => { lock(); location.reload(); } }, icon('lock', 16), 'Sair'),
    ] : [],
  });
  ctx.onLeave(() => { /* mantém a sessão enquanto o auto-lock não dispara */ });

  if (!file) {
    header('Ainda não configurado');
    if (!store.canWrite()) { view.append(h('section', { class: 'panel' }, h('div', { class: 'empty' }, h('h3', null, 'Cofre não criado'), h('p', null, 'Crie o cofre pelo PC, com o servidor local rodando (start.cmd).')))); return; }
    return setup(view, ctx);
  }
  if (!session.key) { header(`${file.entries ?? '?'} itens · trancado`); return unlock(view, ctx, file); }
  header(`${session.data.entries.length} itens · sessão encerra após 15 min parado`);
  return vaultUI(view, ctx);

  /* ---------------- Formulários do cofre ---------------- */
  function editEntry(e) {
    const isNew = !e;
    e = e || { id: uid('v-'), title: '', username: '', password: C.generatePassword(20), url: '', totp: '', notes: '', tags: [] };
    const title = h('input', { class: 'input', value: e.title, placeholder: 'Ex.: Gmail, Nubank, GitHub' });
    const user = h('input', { class: 'input', value: e.username, autocomplete: 'off', placeholder: 'E-mail ou usuário' });
    const pw = h('input', { class: 'input input--mono', type: 'password', value: e.password, autocomplete: 'new-password' });
    const meter = h('div', { class: 'meter' }, h('i'), h('i'), h('i'), h('i'));
    const meterLabel = h('small');
    const upd = () => { const s = C.strength(pw.value); meter.dataset.l = s.level; meterLabel.textContent = `${s.label} · ~${s.bits} bits`; };
    pw.addEventListener('input', upd); upd();
    const show = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Mostrar senha', onclick: () => { pw.type = pw.type === 'password' ? 'text' : 'password'; } }, icon('eye', 16));
    const gen = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Gerar senha', onclick: () => { pw.value = C.generatePassword(20); pw.type = 'text'; upd(); } }, icon('dice', 16));
    const url = h('input', { class: 'input', value: e.url, placeholder: 'https://' });
    const totp = h('input', { class: 'input input--mono', value: e.totp || '', placeholder: 'Chave 2FA do site (opcional)' });
    const notes = h('textarea', { class: 'textarea' }, e.notes || '');
    const folders = [...new Set(session.data.entries.map((x) => x.folder).filter(Boolean))].sort();
    const folder = h('input', { class: 'input', value: e.folder || '', placeholder: 'Ex.: Bancos, Trabalho, Jogos', list: 'vault-folders' });
    const folderList = h('datalist', { id: 'vault-folders' }, folders.map((x) => h('option', { value: x })));
    drawer({
      title: isNew ? 'Nova senha' : `Editar · ${e.title}`,
      body: h('div', { class: 'stack' },
        field('Nome', title), field('Usuário', user),
        h('div', { class: 'field' }, h('label', { for: 'pw-f' }, 'Senha'), h('div', { class: 'input-row' }, Object.assign(pw, { id: 'pw-f' }), show, gen), meter, meterLabel),
        field('Site', url),
        field('Pasta', folder, 'Opcional. Agrupa as senhas na lista.'), folderList,
        field('Código 2FA do site', totp, 'Cole a chave secreta que o site mostra ao ativar 2FA. O PlanLife passa a exibir o código de 6 dígitos.'),
        field('Notas', notes)),
      actions: [
        isNew ? null : (close) => h('button', { class: 'btn btn--danger', onclick: async () => {
          if (!confirm(`Excluir “${e.title}” do cofre? Isso não pode ser desfeito (a não ser pelo histórico do Git).`)) return;
          session.data.entries = session.data.entries.filter((x) => x.id !== e.id);
          if (await guard(persist, 'Item excluído')) { close(); ctx.refresh(); }
        } }, icon('trash', 16), 'Excluir'),
        (close) => h('button', { class: 'btn btn--ghost', onclick: close }, 'Cancelar'),
        (close) => h('button', { class: 'btn btn--primary', onclick: async () => {
          if (!title.value.trim()) { title.focus(); return; }
          if (totp.value.trim()) { try { C.base32Decode(totp.value); } catch { totp.focus(); return toast('A chave 2FA precisa estar em Base32 (letras A–Z e números 2–7).', 'error'); } }
          const item = { ...e, title: title.value.trim(), username: user.value.trim(), password: pw.value, url: url.value.trim(), folder: folder.value.trim(), totp: totp.value.replace(/\s/g, '').toUpperCase(), notes: notes.value, updatedAt: nowISO(), createdAt: e.createdAt || nowISO() };
          const i = session.data.entries.findIndex((x) => x.id === e.id);
          if (i >= 0) session.data.entries[i] = item; else session.data.entries.push(item);
          if (await guard(persist, isNew ? 'Senha salva no cofre' : 'Alterações salvas')) { close(); ctx.go(`#/cofre?id=${item.id}`); ctx.refresh(); }
        } }, 'Salvar'),
      ].filter(Boolean),
    });
  }

  function openGenerator() {
    let len = 20; const opts = { lower: true, upper: true, digits: true, symbols: true };
    const out = h('div', { class: 'secret', style: { fontSize: '18px', padding: '14px' } });
    const meter = h('div', { class: 'meter' }, h('i'), h('i'), h('i'), h('i'));
    const gen = () => { const p = C.generatePassword(len, opts); out.textContent = p; meter.dataset.l = C.strength(p).level; };
    const range = h('input', { type: 'range', min: 8, max: 64, value: len, 'aria-label': 'Tamanho' });
    const lenLabel = h('span', { class: 'num', style: { fontSize: '18px' } }, len);
    range.addEventListener('input', () => { len = +range.value; lenLabel.textContent = len; gen(); });
    const opt = (k, l) => { const cb = h('input', { type: 'checkbox', checked: true, id: `g-${k}` }); cb.addEventListener('change', () => { opts[k] = cb.checked; gen(); }); return h('label', { class: 'row', for: `g-${k}` }, cb, l); };
    gen();
    drawer({
      title: 'Gerador de senhas',
      body: h('div', { class: 'stack' }, out, meter, h('div', { class: 'row' }, h('span', { class: 'label' }, 'Tamanho'), range, lenLabel),
        h('div', { class: 'grid-2' }, opt('lower', 'minúsculas'), opt('upper', 'MAIÚSCULAS'), opt('digits', 'números'), opt('symbols', 'símbolos'))),
      actions: [h('button', { class: 'btn', onclick: gen }, icon('refresh', 16), 'Gerar outra'), h('button', { class: 'btn btn--primary', onclick: () => copyText(out.textContent, 'Senha copiada', 20) }, icon('copy', 16), 'Copiar')],
    });
  }

  /* ---------------- Importação ---------------- */
  function openImport() {
    const input = h('input', { type: 'file', accept: '.json,.csv,application/json,text/csv', class: 'sr-only', id: 'imp-file' });
    const drop = h('label', { class: 'imp-drop', for: 'imp-file' }, icon('upload', 26),
      h('b', null, 'Escolha ou arraste o arquivo'), h('span', null, 'JSON ou CSV · Bitwarden, navegadores e listas próprias'));
    const result = h('div', { class: 'stack' });
    const footBtn = h('button', { class: 'btn btn--primary', disabled: true }, 'Importar');
    let parsed = null, rows = [];
    const existing = new Set(session.data.entries.map(dupKey));

    const handle = async (file) => {
      if (!file) return;
      touch();
      try {
        parsed = parseImport(await file.text(), file.name);
      } catch (err) { result.replaceChildren(h('div', { class: 'banner', role: 'alert' }, icon('x'), h('span', null, err.message))); footBtn.disabled = true; return; }
      const seen = new Set();
      rows = parsed.entries.map((e) => {
        const k = dupKey(e);
        const dup = existing.has(k) || seen.has(k);
        seen.add(k);
        return { e, dup, on: !dup };
      });
      draw(file.name);
    };
    input.addEventListener('change', () => handle(input.files[0]));
    drop.addEventListener('dragover', (ev) => { ev.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (ev) => { ev.preventDefault(); drop.classList.remove('is-over'); handle(ev.dataTransfer.files[0]); });

    const folderAll = h('input', { class: 'input', placeholder: 'Opcional, ex.: Importadas', list: 'imp-folders' });
    const count = () => rows.filter((r) => r.on).length;
    const refreshBtn = () => { const n = count(); footBtn.disabled = !n; footBtn.textContent = n ? `Importar ${n} ${n === 1 ? 'senha' : 'senhas'}` : 'Importar'; };

    function draw(name) {
      const dups = rows.filter((r) => r.dup).length;
      const noPw = rows.filter((r) => !r.e.password).length;
      const list = h('div', { class: 'imp-list', role: 'list' });
      // separa por pasta (quando houver) ou por letra inicial
      const hasFolders = rows.some((r) => r.e.folder);
      const groupOf = (r) => hasFolders ? (r.e.folder || 'Sem pasta') : ((r.e.title[0] || '#').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/, '#'));
      const sorted = [...rows].sort((a, b) => groupOf(a).localeCompare(groupOf(b), 'pt-BR') || a.e.title.localeCompare(b.e.title, 'pt-BR'));
      let last = null;
      for (const r of sorted) {
        const g = groupOf(r);
        if (g !== last) { last = g; list.append(h('div', { class: 'imp-group' }, g, h('span', null, sorted.filter((x) => groupOf(x) === g).length))); }
        const cb = h('input', { type: 'checkbox', checked: r.on, 'aria-label': `Importar ${r.e.title}` });
        cb.addEventListener('change', () => { r.on = cb.checked; refreshBtn(); });
        list.append(h('label', { class: `imp-row${r.dup ? ' is-dup' : ''}`, role: 'listitem' }, cb,
          h('span', { class: 'imp-main' }, h('b', null, r.e.title), h('small', null, [r.e.username || 'sem usuário', r.e.url ? r.e.url.replace(/^https?:\/\//, '') : null].filter(Boolean).join(' · '))),
          h('span', { class: 'imp-tags' },
            r.dup ? h('span', { class: 'imp-tag imp-tag--dup' }, 'já existe') : null,
            !r.e.password ? h('span', { class: 'imp-tag' }, 'só nota') : null,
            r.e.totp ? h('span', { class: 'imp-tag' }, '2FA') : null)));
      }
      const all = h('input', { type: 'checkbox', checked: rows.every((r) => r.on), id: 'imp-all' });
      all.addEventListener('change', () => { rows.forEach((r) => { r.on = all.checked; }); list.querySelectorAll('.imp-row input').forEach((x) => { x.checked = all.checked; }); refreshBtn(); });
      const skipDup = h('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => { rows.forEach((r) => { if (r.dup) r.on = false; }); draw(name); } }, 'Desmarcar duplicados');
      const folders = [...new Set(session.data.entries.map((x) => x.folder).filter(Boolean))];
      result.replaceChildren(
        h('div', { class: 'imp-summary' },
          h('div', null, h('b', { class: 'num' }, rows.length), h('span', null, 'senhas encontradas')),
          h('div', null, h('b', { class: 'num' }, dups), h('span', null, 'repetidas ou já no cofre')),
          h('div', null, h('b', { class: 'num' }, parsed.skipped), h('span', null, 'linhas ignoradas'))),
        h('p', { class: 'note' }, `Arquivo ${name} · formato ${parsed.format}${noPw ? ` · ${noPw} sem senha (entram como nota)` : ''}.`),
        field('Colocar todas numa pasta', folderAll, 'Deixe vazio para manter as pastas do arquivo.'),
        h('datalist', { id: 'imp-folders' }, folders.map((x) => h('option', { value: x }))),
        h('div', { class: 'row' }, h('label', { class: 'row', for: 'imp-all' }, all, 'Selecionar todas'), h('span', { class: 'spacer' }), dups ? skipDup : null),
        list);
      refreshBtn();
    }

    drawer({
      title: 'Importar senhas',
      body: h('div', { class: 'stack' },
        h('p', { class: 'note' }, 'O arquivo é lido só neste navegador e nunca é enviado. As senhas entram cifradas no cofre.'),
        input, drop, result),
      actions: [
        (close) => h('button', { class: 'btn btn--ghost', onclick: close }, 'Cancelar'),
        (close) => {
          footBtn.addEventListener('click', async () => {
            const pick = rows.filter((r) => r.on);
            if (!pick.length) return;
            const now = nowISO();
            const target = folderAll.value.trim();
            const items = pick.map(({ e }) => ({
              id: uid('v-'), title: e.title, username: e.username, password: e.password, url: e.url || '', totp: e.totp || '',
              notes: e.notes || '', folder: target || e.folder || '', tags: [], createdAt: e.createdAt || e.updatedAt || now, updatedAt: e.updatedAt || now, importedAt: now,
            }));
            session.data.entries.push(...items);
            footBtn.classList.add('is-busy');
            if (await guard(persist, `${items.length} ${items.length === 1 ? 'senha importada' : 'senhas importadas'} para o cofre`)) {
              close();
              toast('Apague o arquivo original do computador: ele guarda as senhas sem criptografia.', 'info', 9000);
              ctx.refresh();
            } else {
              session.data.entries.splice(-items.length, items.length);
              footBtn.classList.remove('is-busy');
            }
          });
          return footBtn;
        },
      ],
    });
  }

  function vaultUI(view, ctx) {
    const entries = [...session.data.entries].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    let current = entries.find((e) => e.id === ctx.params.get('id')) || entries[0];
    const search = h('input', { class: 'input', type: 'search', placeholder: 'Buscar', 'aria-label': 'Buscar no cofre' });
    const listEl = h('div', { class: 'vault-items' });
    const allFolders = [...new Set(entries.map((e) => e.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const folderSel = h('select', { class: 'select', 'aria-label': 'Filtrar por pasta', style: allFolders.length ? { marginTop: '8px' } : { display: 'none' } },
      h('option', { value: '' }, `Todas as pastas (${entries.length})`),
      allFolders.map((f) => h('option', { value: f }, `${f} (${entries.filter((e) => e.folder === f).length})`)));
    folderSel.addEventListener('change', () => drawList());
    const detail = h('div', { class: 'vault-detail' });
    let totpTimer = null;
    ctx.onLeave(() => clearInterval(totpTimer));

    const avatarColor = (s) => ['#2563EB', '#0E9F6E', '#7445D8', '#E0452B', '#0891B2', '#C99A06', '#DB2777'][[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 7];
    function drawList() {
      const q = search.value.trim().toLowerCase();
      clear(listEl);
      const list = entries.filter((e) => (!folderSel.value || (e.folder || '') === folderSel.value) && (!q || `${e.title} ${e.username} ${e.url} ${e.folder || ''}`.toLowerCase().includes(q)));
      if (!list.length) listEl.append(h('p', { class: 'note', style: { padding: '16px' } }, entries.length ? 'Nada encontrado.' : 'Cofre vazio. Adicione sua primeira senha ou importe um arquivo.'));
      // separa por pasta quando houver pastas; senão, por letra inicial
      const hasFolders = entries.some((e) => e.folder);
      const groupOf = (e) => hasFolders ? (e.folder || 'Sem pasta') : ((e.title[0] || '#').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/, '#'));
      list.sort((a, b) => groupOf(a).localeCompare(groupOf(b), 'pt-BR') || a.title.localeCompare(b.title, 'pt-BR'));
      let lastGroup = null;
      for (const e of list) {
        const g = groupOf(e);
        if (g !== lastGroup && list.length > 6) { lastGroup = g; listEl.append(h('div', { class: 'vault-group' }, g, h('span', null, list.filter((x) => groupOf(x) === g).length))); }
        const b = h('button', { class: 'vault-item', 'aria-current': String(e === current) },
          h('span', { class: 'vault-avatar', style: { background: avatarColor(e.title) } }, (e.title[0] || '?').toUpperCase()),
          h('span', null, h('b', null, e.title), h('small', null, e.username || e.url || '—')));
        b.addEventListener('click', () => { current = e; touch(); drawList(); drawDetail(); });
        listEl.append(b);
      }
    }
    function drawDetail() {
      clearInterval(totpTimer);
      clear(detail);
      if (!current) { detail.append(h('div', { class: 'empty' }, h('h3', null, 'Nenhum item'), h('p', null, 'Use “Nova senha” para guardar o primeiro acesso.'))); return; }
      const e = current;
      let revealed = false;
      const pwVal = h('span', { class: 'val secret-val' }, '••••••••••••');
      const row = (label, val, actions) => h('div', { class: 'vfield' }, h('span', null, label), val, h('div', { class: 'row' }, actions));
      detail.append(
        h('div', { class: 'row' }, h('h2', null, e.title), h('span', { class: 'spacer' }), store.canWrite() ? h('button', { class: 'btn btn--sm', onclick: () => editEntry(e) }, icon('edit', 15), 'Editar') : null),
        h('div', null,
          row('Usuário', h('span', { class: 'val' }, e.username || '—'), e.username ? [h('button', { class: 'iconbtn', 'aria-label': 'Copiar usuário', onclick: () => copyText(e.username, 'Usuário copiado') }, icon('copy', 16))] : []),
          row('Senha', pwVal, [
            h('button', { class: 'iconbtn', 'aria-label': 'Mostrar ou ocultar senha', onclick: () => { revealed = !revealed; pwVal.textContent = revealed ? e.password : '••••••••••••'; touch(); } }, icon('eye', 16)),
            h('button', { class: 'iconbtn', 'aria-label': 'Copiar senha', onclick: () => { copyText(e.password, 'Senha copiada', 20); touch(); } }, icon('copy', 16))]),
          e.folder ? row('Pasta', h('span', { class: 'val' }, e.folder), []) : null,
          e.url ? row('Site', h('a', { class: 'val', href: e.url, target: '_blank', rel: 'noopener noreferrer' }, e.url), []) : null,
          e.totp ? (() => {
            const code = h('span', { class: 'num' }, '······');
            const secs = h('span', { class: 'muted num' });
            const tick = async () => { try { const c = await C.totp(e.totp); code.textContent = `${c.slice(0, 3)} ${c.slice(3)}`; code.dataset.raw = c; secs.textContent = `${30 - (Math.floor(Date.now() / 1000) % 30)}s`; } catch { code.textContent = 'chave inválida'; } };
            tick(); totpTimer = setInterval(tick, 1000);
            return row('Código 2FA', h('div', { class: 'totp-live' }, code, secs), [h('button', { class: 'iconbtn', 'aria-label': 'Copiar código', onclick: () => copyText(code.dataset.raw, 'Código copiado') }, icon('copy', 16))]);
          })() : null,
          e.notes ? row('Notas', h('span', { class: 'val', style: { whiteSpace: 'pre-wrap' } }, e.notes), []) : null),
        h('p', { class: 'note' }, `Força da senha: ${C.strength(e.password).label}. Atualizado em ${e.updatedAt ? fmtShort(new Date(e.updatedAt)) : '—'}. A área de transferência é limpa 20 s depois de copiar.`));
    }
    search.addEventListener('input', drawList);
    drawList(); drawDetail();
    view.append(h('section', { class: 'panel vault' }, h('div', { class: 'vault-list' }, h('div', { class: 'vault-search' }, search, folderSel), listEl), detail));
    view.append(h('p', { class: 'note' }, h('b', null, 'Como funciona: '), 'a Chave Mestra nunca é salva. Dela sai a chave AES que cifra o arquivo data/vault/vault.enc.json. O 2FA é uma segunda verificação feita depois de decifrar, com o seu app autenticador. Se esquecer a Chave Mestra, os dados não podem ser recuperados.'));
  }
}

/* ---------------- Portal de acesso (tela trancada / criação) ----------------
   Anéis em órbita na cor do ciclo, ondas que pulsam a partir do centro e leve paralaxe
   que segue o ponteiro. Respeita prefers-reduced-motion. */
const RINGS = [300, 372, 452, 542, 644, 758, 884, 1000];
const pIcon = (name) => icon(name, 19);

function portal(view, ctx) {
  const ns = 'http://www.w3.org/2000/svg';
  const rings = document.createElementNS(ns, 'svg');
  rings.setAttribute('class', 'portal-rings'); rings.setAttribute('viewBox', '0 0 2000 2000'); rings.setAttribute('aria-hidden', 'true');
  rings.innerHTML = `<defs><linearGradient id="vault-arc" gradientUnits="userSpaceOnUse" x1="300" y1="300" x2="1700" y2="1700">
      <stop style="stop-color: var(--mode)"/><stop offset=".55" style="stop-color: #7FA0FF"/><stop offset="1" style="stop-color: var(--mode-ink)"/></linearGradient></defs>
    <circle class="wave" cx="1000" cy="1000" r="300"/><circle class="wave wave-b" cx="1000" cy="1000" r="300"/>
    ${RINGS.map((r, i) => { const len = 9 + (i % 3) * 5; return `<circle class="base" cx="1000" cy="1000" r="${r}"/>
      <circle class="arc${i % 2 ? ' reverse' : ''}" cx="1000" cy="1000" r="${r}" pathLength="100" stroke-dasharray="${len} ${100 - len}" style="--duration:${38 + i * 12}s; animation-delay:${-i * 7.3}s"/>`; }).join('')}`;
  const col = h('div', { class: 'portal-col' });
  const stage = h('section', { class: 'portal', 'aria-label': 'Acesso ao cofre' },
    h('div', { class: 'portal-glow', 'aria-hidden': 'true' }), rings, col,
    h('footer', { class: 'portal-foot' },
      h('span', null, icon('shield', 14), 'AES-256-GCM · PBKDF2 600 mil iterações · 2FA TOTP'),
      h('span', null, 'Todos os dados ficam cifrados · sessão encerra após 15 min parado')));
  view.append(stage);

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    let frame, px = 0, py = 0, tx = 0, ty = 0;
    const move = (e) => { tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; };
    const tick = () => {
      px += (tx - px) * 0.05; py += (ty - py) * 0.05;
      stage.style.setProperty('--tx', `${(px * -14).toFixed(2)}px`);
      stage.style.setProperty('--ty', `${(py * -10).toFixed(2)}px`);
      frame = requestAnimationFrame(tick);
    };
    addEventListener('pointermove', move);
    frame = requestAnimationFrame(tick);
    ctx.onLeave(() => { removeEventListener('pointermove', move); cancelAnimationFrame(frame); });
  }
  return { stage, col };
}

// marca do PlanLife (barras de carga) que entra girando
const vaultMark = () => h('div', { class: 'portal-mark rise', html: `<svg viewBox="0 0 32 32" aria-hidden="true">
  <rect class="m-a" x="4" y="19" width="5" height="9" rx="1.5" fill="currentColor" opacity=".45"/>
  <rect class="m-b" x="11" y="13" width="5" height="15" rx="1.5" fill="currentColor" opacity=".75"/>
  <rect class="m-c" x="18" y="6" width="5" height="22" rx="1.5" fill="var(--mode)"/>
  <rect class="m-a" x="25" y="15" width="3.5" height="13" rx="1.5" fill="currentColor" opacity=".45"/></svg>` });

/** Campo do portal: ícone + input + ação opcional à direita. */
function pfield({ iconName, input, label, trailing }) {
  input.classList.add('pfield-input');
  input.setAttribute('aria-label', label);
  if (!input.placeholder) input.placeholder = label;
  return h('label', { class: 'pfield rise' }, pIcon(iconName), input, trailing || null);
}
function eyeToggle(input) {
  const b = h('button', { type: 'button', class: 'pfield-eye', 'aria-label': 'Mostrar Chave Mestra', 'aria-pressed': 'false' }, pIcon('eye'));
  b.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.setAttribute('aria-pressed', String(show)); b.setAttribute('aria-label', show ? 'Ocultar Chave Mestra' : 'Mostrar Chave Mestra');
    b.replaceChildren(pIcon(show ? 'eyeOff' : 'eye')); input.focus();
  });
  return b;
}
function pbutton(label, stage) {
  const b = h('button', { class: 'pbtn rise', type: 'submit' }, h('span', { class: 'pbtn-label' }, label), icon('right', 18));
  b.addEventListener('pointerenter', () => stage.classList.add('is-hovering'));
  b.addEventListener('pointerleave', () => stage.classList.remove('is-hovering'));
  b.setLabel = (t) => { b.querySelector('.pbtn-label').textContent = t; };
  return b;
}
const stagger = (col) => col.querySelectorAll('.rise').forEach((el, i) => el.style.setProperty('--d', i));
const backLink = (label, fn) => h('button', { type: 'button', class: 'plink rise', onclick: fn }, label);

/* ---------------- Criação ---------------- */
function setup(view, ctx) {
  let step = 1; let master = ''; const secret = C.newTotpSecret();
  const { stage, col: host } = portal(view, ctx);
  const draw = async () => {
    clear(host);
    host.append(vaultMark(), h('div', { class: 'portal-steps rise', role: 'img', 'aria-label': `Passo ${step} de 2` }, h('span', { class: 'is-on' }), h('span', { class: step > 1 ? 'is-on' : '' })));
    if (step === 1) {
      const p1 = h('input', { type: 'password', autocomplete: 'new-password' });
      const p2 = h('input', { type: 'password', autocomplete: 'new-password' });
      const meter = h('div', { class: 'meter' }, h('i'), h('i'), h('i'), h('i'));
      const lab = h('small', { class: 'portal-hint' }, 'Mínimo de 12 caracteres. Uma frase de 4 ou 5 palavras funciona bem.');
      p1.addEventListener('input', () => { const s = C.strength(p1.value); meter.dataset.l = s.level; lab.textContent = p1.value ? `${s.label} · ~${s.bits} bits` : 'Mínimo de 12 caracteres. Uma frase de 4 ou 5 palavras funciona bem.'; });
      const next = pbutton('Continuar', stage);
      const form = h('form', { class: 'portal-form' },
        pfield({ iconName: 'lock', input: p1, label: 'Nova Chave Mestra', trailing: eyeToggle(p1) }),
        h('div', { class: 'portal-meter rise' }, meter, lab),
        pfield({ iconName: 'lock', input: p2, label: 'Repita a Chave Mestra' }), next);
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        if (p1.value.length < 12) return toast('Use pelo menos 12 caracteres. Uma frase com 4 ou 5 palavras funciona bem.', 'error');
        if (C.strength(p1.value).level < 3) return toast('Chave fraca. Misture palavras, números e símbolos.', 'error');
        if (p1.value !== p2.value) return toast('As duas chaves não são iguais.', 'error');
        master = p1.value; step = 2; draw();
      });
      host.append(h('h2', { class: 'rise' }, 'Crie sua Chave Mestra'),
        h('p', { class: 'portal-sub rise' }, 'Ela abre o cofre e nunca é salva. Sem ela, não há como recuperar as senhas.'), form,
        h('p', { class: 'portal-note rise' }, 'Anote a Chave Mestra num lugar físico seguro.'));
      p1.focus();
    } else {
      const code = h('input', { class: 'pfield-code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, placeholder: '000000' });
      const btn = pbutton('Ativar 2FA e criar cofre', stage);
      const form = h('form', { class: 'portal-form' }, pfield({ iconName: 'shield', input: code, label: 'Código do app autenticador' }), btn);
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (!(await C.verifyTotp(secret, code.value))) { code.select(); return toast('Código incorreto. Confira o relógio do celular e tente o código atual.', 'error'); }
        btn.classList.add('is-busy'); btn.setLabel('Derivando a chave…');
        const ok = await guard(async () => {
          const salt = C.b64(C.randomBytes(16));
          const key = await C.deriveKey(master, salt);
          const data = { entries: [], twoFactor: { secret, createdAt: nowISO() } };
          const { iv, data: ct } = await C.encryptJSON(key, data, AAD);
          const file = {
            schema: 'planlife.vault', version: 1, createdAt: nowISO(), updatedAt: nowISO(),
            kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: C.KDF_ITERATIONS, salt },
            cipher: { name: 'AES-GCM', length: 256, iv, aad: AAD }, twoFactor: { type: 'totp', algorithm: 'SHA1', digits: 6, period: 30 },
            entries: 0, data: ct,
          };
          await store.save(PATH, file);
          store.markVaultCreated();
          openSession(key, data, file);
          await store.encryptPlainFiles();
        }, 'Cofre criado');
        master = '';
        if (ok) ctx.refresh(); else { btn.classList.remove('is-busy'); btn.setLabel('Ativar 2FA e criar cofre'); }
      });
      const uri = C.totpUri(secret, 'Cofre');
      host.append(h('h2', { class: 'rise' }, 'Ative o 2FA'),
        h('p', { class: 'portal-sub rise' }, 'Escaneie com Google Authenticator, Microsoft Authenticator, Authy ou 1Password.'),
        h('div', { class: 'portal-qr rise' }, await qrSvg(uri),
          h('div', { class: 'portal-qr-key' }, h('span', { class: 'label' }, 'Ou digite a chave'), h('div', { class: 'secret' }, secret.match(/.{1,4}/g).join(' ')),
            h('small', { class: 'muted' }, 'Baseado em tempo, 6 dígitos.'))),
        form, backLink('Voltar para a Chave Mestra', () => { step = 1; draw(); }));
      code.focus();
    }
    stagger(host);
  };
  draw();
}

/* ---------------- Abertura ---------------- */
function unlock(view, ctx, file) {
  const { stage, col: host } = portal(view, ctx);
  let attempts = 0;
  const stage1 = () => {
    clear(host);
    const pw = h('input', { type: 'password', autocomplete: 'current-password' });
    const btn = pbutton('Continuar', stage);
    const form = h('form', { class: 'portal-form' }, pfield({ iconName: 'lock', input: pw, label: 'Chave Mestra', trailing: eyeToggle(pw) }), btn);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!pw.value) return pw.focus();
      btn.classList.add('is-busy'); btn.setLabel('Verificando…');
      try {
        const key = await C.deriveKey(pw.value, file.kdf.salt, file.kdf.iterations);
        const data = await C.decryptJSON(key, file.cipher.iv, file.data, file.cipher.aad);
        pw.value = '';
        stage2(key, data);
      } catch {
        attempts++;
        btn.classList.remove('is-busy'); btn.setLabel('Continuar');
        pw.select();
        toast(attempts >= 3 ? 'Chave Mestra incorreta. Cuidado com Caps Lock e acentos.' : 'Chave Mestra incorreta.', 'error');
      }
    });
    const forgot = h('details', { class: 'portal-forgot rise' }, h('summary', null, 'Esqueceu a Chave Mestra?'),
      h('p', null, 'Ela nunca é salva, então não existe recuperação. Sem a Chave Mestra, o conteúdo do cofre não pode ser decifrado.'));
    host.append(vaultMark(),
      h('h2', { class: 'rise' }, ctx.gate ? 'Entrar no PlanLife' : 'Cofre trancado'),
      h('p', { class: 'portal-sub rise' }, ctx.gate ? 'Seus dados ficam cifrados. Digite a Chave Mestra e depois o código do app autenticador.' : `${!file.entries ? 'Nenhum item guardado ainda' : `${file.entries} ${file.entries === 1 ? 'item protegido' : 'itens protegidos'}`}. Digite sua Chave Mestra e depois o código 2FA.`),
      form, forgot);
    stagger(host);
    pw.focus();
  };
  const stage2 = (key, data) => {
    clear(host);
    const code = h('input', { class: 'pfield-code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, placeholder: '000000' });
    const form = h('form', { class: 'portal-form' }, pfield({ iconName: 'shield', input: code, label: 'Código 2FA' }), pbutton('Destrancar', stage));
    const submit = async (ev) => {
      ev?.preventDefault();
      if (await C.verifyTotp(data.twoFactor.secret, code.value)) {
        openSession(key, data, file);
        const n = await store.encryptPlainFiles().catch(() => 0);
        if (n) toast(` arquivos de dados foram cifrados.`, 'ok');
        ctx.refresh();
      } else { code.select(); toast('Código inválido ou expirado.', 'error'); }
    };
    form.addEventListener('submit', submit);
    code.addEventListener('input', () => { if (code.value.replace(/\D/g, '').length === 6) submit(); });
    host.append(vaultMark(), h('h2', { class: 'rise' }, 'Verificação em duas etapas'),
      h('p', { class: 'portal-sub rise' }, 'Abra seu app autenticador e digite o código de 6 dígitos do PlanLife.'), form,
      backLink('Voltar para a Chave Mestra', stage1));
    stagger(host);
    code.focus();
  };
  stage1();
}

/** Tela de entrada do app: cria o cofre (primeiro uso) ou pede Chave Mestra + 2FA. */
export async function renderLogin(view, ctx) {
  store.invalidate(PATH);
  const file = await store.load(PATH, null);
  if (!file) return setup(view, ctx);
  return unlock(view, ctx, file);
}