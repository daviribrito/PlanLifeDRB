# PlanLife

Sistema pessoal de gestão de vida: **rotina principal**, **ciclos de foco** com sugestões de IA, **agenda Google**, **finanças por objetivos** e **cofre de senhas** com Chave Mestra + 2FA.

Sem build, sem Node, sem banco de dados. Os dados são arquivos JSON na pasta [`data/`](data/), versionados pelo Git.

## Como rodar no PC

Dê dois cliques em **`start.cmd`**. Ele abre `http://localhost:3100` e inicia um servidor local em PowerShell (já vem no Windows) que grava as alterações em `data/`.

Ou, num terminal:

```powershell
pwsh -File serve.ps1
```

Para parar: `Ctrl+C` na janela do servidor.

## Fluxo com GitHub

1. Use o PlanLife no PC (com `start.cmd`). Cada alteração vira um arquivo em `data/`.
2. Faça commit e push:
   ```powershell
   git add data
   git commit -m "Atualiza dados"
   git push
   ```
3. Em outro PC: `git clone` (ou `git pull`) e `start.cmd`. Tudo continua de onde parou.

> Git não está instalado nesta máquina. Instale o [Git for Windows](https://git-scm.com/download/win) ou o [GitHub Desktop](https://desktop.github.com/).

### GitHub Pages (somente leitura)

Em **Settings → Pages**, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`. O site publicado mostra seus dados em **modo leitura** (não há servidor para gravar). O cofre pode ser aberto lá também, porque a decifração acontece no navegador.

**Privacidade:** o Pages publica tudo que está no repositório. Se o repositório for público, rotina, ciclos e finanças ficam visíveis para qualquer pessoa. Só o cofre é cifrado. Recomendado: repositório **privado** (Pages em repositório privado exige plano GitHub Pro/Team).

## Telas

| Tela | O que faz |
|---|---|
| **Hoje** | Faixa de periodização (6 semanas em faixas Mês / Semana / Dias), linha do tempo do dia com altura proporcional à duração, tempo livre restante, sugestões e perguntas da IA para aceitar ou recusar, ideias rápidas do ciclo. |
| **Rotina** | Blocos fixos por dia da semana. A IA nunca altera esses blocos. Marque cada bloco como feito ou pulado em Hoje. |
| **Ciclos de foco** | Defina um foco para um mês, uma semana ou um período com dias específicos (ex.: Finanças só às segundas e terças). O ciclo mais específico vence. Edite os modos (cor, instruções para a IA, ideias rápidas). |
| **Agenda** | Semana com seus eventos do Google Agenda sobrepostos à rotina. |
| **Finanças** | Patrimônio acompanhado, contas e investimentos, distribuição por tipo, evolução em 12 meses e metas com ritmo de aporte. Não é controle de gastos. |
| **Cofre** | Senhas cifradas com AES-256-GCM. Abre com Chave Mestra + código do app autenticador. Também guarda chaves 2FA de outros sites e mostra os códigos. |
| **Assistente** | Gera sugestões para hoje, 3 dias ou a semana; histórico de aceitas, recusadas e perguntas. |
| **Ajustes** | Provedor de IA, Google Agenda, horário do dia, exportação de tudo em um JSON. |

## IA

Funciona com **Anthropic (Claude)**, **OpenAI**, **Google (Gemini)** ou qualquer API **compatível com OpenAI** (OpenRouter, Groq, Ollama local). Configure em *Ajustes*.

- A chave de API fica **só no navegador** (localStorage). Nunca vai para `data/`. Em outro PC, cole de novo.
- A IA recebe: ciclos ativos e suas metas, instruções do modo, compromissos do dia, janelas livres, o que você aceitou/recusou e as respostas às perguntas dela. No modo Finanças, recebe também os saldos e metas.
- Ela só sugere extras que cabem nas janelas livres. A rotina principal não muda. Você decide cada sugestão.

## Google Agenda

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e ative a **Google Calendar API**.
2. Em *APIs e serviços → Tela de consentimento OAuth*, configure como *Externo* e adicione seu e-mail como usuário de teste.
3. Em *Credenciais → Criar credenciais → ID do cliente OAuth*, tipo **Aplicativo da Web**.
4. Em *Origens JavaScript autorizadas*, adicione:
   - `http://localhost:3100`
   - `https://SEU-USUARIO.github.io`
5. Copie o **Client ID** e cole em *Ajustes → Google Agenda*. Depois clique em *Conectar*.

Os eventos são lidos ao vivo e não são gravados nos arquivos. Sugestões aceitas com horário podem ser enviadas para o Google Agenda.

## Segurança do cofre

- **Chave Mestra** → PBKDF2-SHA256 com 600.000 iterações e salt aleatório → chave AES-256-GCM. A Chave Mestra nunca é salva.
- O arquivo [`data/vault/vault.enc.json`](data/vault/) só tem metadados (algoritmo, salt, IV) e o conteúdo cifrado.
- **2FA (TOTP)** compatível com Google Authenticator, Microsoft Authenticator, Authy, 1Password.
- Tranca sozinho após 5 minutos parado. A área de transferência é limpa 20 s depois de copiar uma senha.

Limite honesto: num app sem servidor, o segredo do 2FA precisa ficar guardado junto dos dados, cifrado pela Chave Mestra. O 2FA impede que alguém que descubra só a sua Chave Mestra abra o cofre pela interface, mas **a proteção real dos dados é a força da Chave Mestra**. Use uma frase longa. Se esquecê-la, não há recuperação.

## Dados e migração

Veja [docs/DATA.md](docs/DATA.md) para a estrutura de cada arquivo e [docs/sql/001_init.sql](docs/sql/001_init.sql) para um esquema SQL equivalente. Em *Ajustes → Exportar tudo* você baixa um JSON único com todos os arquivos.

## Estrutura

```
index.html            app (abre em localhost ou no GitHub Pages)
serve.ps1, start.cmd  servidor local que grava em data/
assets/css/app.css    design system
assets/js/            app, dados, IA, Google, criptografia e telas
data/                 seus dados (JSON, um arquivo por coleção)
docs/                 estrutura dos dados e SQL de migração
```

Os dados iniciais (rotina e ciclos de novembro/2026) são **exemplos**. Edite ou apague à vontade.
