# Estrutura dos dados

Cada coleção é um arquivo JSON em `data/`. Todos usam o mesmo envelope, o que torna a migração mecânica: cada `items[]` vira uma tabela, cada objeto uma linha.

```json
{
  "schema": "planlife.<coleção>",
  "version": 1,
  "updatedAt": "2026-11-22T12:00:00.000Z",
  "items": [ ... ]
}
```

Convenções:

- `id`: texto único e estável (nunca reutilizado). Chave primária.
- Datas: `YYYY-MM-DD` (dia local). Horários: `HH:MM` (24 h). Instantes: ISO 8601 em UTC.
- Dias da semana: ISO, `1` = segunda … `7` = domingo.
- Valores em dinheiro: número em reais (BRL), ponto decimal.
- Relações por id (`modeId`, `accountId`, `blockId`), como chaves estrangeiras.
- Todo item tem `createdAt` e `updatedAt`.
- `version` muda quando o formato muda; a migração lê a versão antes de importar.

| Arquivo | Schema | Tabela SQL |
|---|---|---|
| `settings.json` | `planlife.settings` | `settings` (uma linha, sem `items`) |
| `routine/blocks.json` | `planlife.routine.block` | `routine_block` + `routine_block_weekday` |
| `routine/logs/YYYY-MM.json` | `planlife.routine.log` | `routine_log` (um arquivo por mês para manter os diffs pequenos) |
| `focus/modes.json` | `planlife.focus.mode` | `focus_mode` + `focus_mode_idea` |
| `focus/cycles.json` | `planlife.focus.cycle` | `focus_cycle` + `focus_cycle_weekday` |
| `ai/suggestions.json` | `planlife.ai.suggestion` | `ai_suggestion` |
| `finance/accounts.json` | `planlife.finance.account` | `finance_account` |
| `finance/snapshots.json` | `planlife.finance.snapshot` | `finance_snapshot` |
| `finance/goals.json` | `planlife.finance.goal` | `finance_goal` + `finance_goal_account` |
| `vault/vault.enc.json` | `planlife.vault` | `vault` (blob cifrado; não migre decifrado) |

## settings

| Campo | Tipo | Notas |
|---|---|---|
| `profile.name` | texto | |
| `day.start`, `day.end` | `HH:MM` | horário acordado; define as janelas livres |
| `weekStart` | int | 1 = segunda |
| `ai.provider` | `anthropic` \| `openai` \| `google` \| `compatible` | |
| `ai.model` | texto | |
| `ai.baseUrl` | texto | só para `compatible` |
| `google.clientId` | texto | Client ID OAuth (não é segredo) |
| `google.calendarIds` | texto[] | `primary` = calendário principal |

Chaves de API **não** ficam aqui (ficam no navegador).

## routine/blocks — bloco da rotina principal

| Campo | Tipo | Notas |
|---|---|---|
| `id` | texto | |
| `title` | texto | |
| `start`, `end` | `HH:MM` | `end` > `start` |
| `weekdays` | int[] | 1–7 |
| `modeId` | texto \| null | → `focus/modes.id` (área/cor) |
| `notes` | texto | |
| `active` | bool | inativo não aparece nos dias |

## routine/logs/YYYY-MM — execução da rotina

| Campo | Tipo | Notas |
|---|---|---|
| `id` | texto | `<date>_<blockId>` (um registro por bloco por dia) |
| `date` | data | |
| `blockId` | texto | → `routine/blocks.id` |
| `status` | `done` \| `skipped` | ausência de registro = pendente |
| `at` | instante | quando foi marcado |

## focus/modes — modo de foco

| Campo | Tipo | Notas |
|---|---|---|
| `id` | texto | |
| `name`, `description` | texto | |
| `color` | hex | cor da faixa |
| `aiBrief` | texto | instruções para a IA quando o modo está ativo |
| `ideas` | texto[] | atalhos que funcionam sem IA |
| `builtin` | bool | veio com o app |

## focus/cycles — ciclo de foco

| Campo | Tipo | Notas |
|---|---|---|
| `id` | texto | |
| `modeId` | texto | → `focus/modes.id` |
| `kind` | `month` \| `week` \| `custom` | faixa onde aparece; precedência no dia: custom > week > month |
| `startDate`, `endDate` | data | inclusivo |
| `weekdays` | int[] | vazio = todos os dias do intervalo |
| `goal` | texto | meta do ciclo, usada pela IA |

## ai/suggestions — sugestões e perguntas da IA

| Campo | Tipo | Notas |
|---|---|---|
| `id` | texto | |
| `date` | data | dia ao qual se refere |
| `kind` | `task` \| `question` | |
| `modeId` | texto | → `focus/modes.id` |
| `title`, `detail` | texto | em perguntas, `title` é a pergunta |
| `start` | `HH:MM` \| null | sem horário = extra flexível |
| `durationMin` | int | |
| `status` | `pending` \| `accepted` \| `done` \| `rejected` \| `answered` | |
| `answer` | texto \| null | resposta do usuário a uma pergunta |
| `source.provider`, `source.model` | texto | `ideias` quando veio das ideias rápidas |
| `decidedAt` | instante | |
| `calendar` | bool | enviada ao Google Agenda |

## finance/accounts — conta ou investimento

| Campo | Tipo | Notas |
|---|---|---|
| `id` | texto | |
| `name`, `institution`, `notes` | texto | |
| `type` | `reserva` \| `poupanca` \| `renda_fixa` \| `fundos` \| `acoes` \| `fii` \| `exterior` \| `previdencia` \| `cripto` \| `conta` \| `outro` | |
| `balance` | número | saldo mais recente |
| `balanceDate` | data | |

## finance/snapshots — histórico de saldo

| Campo | Tipo | Notas |
|---|---|---|
| `id` | texto | `<accountId>_<date>` (um por conta por dia) |
| `accountId` | texto | → `finance/accounts.id` |
| `date` | data | |
| `balance` | número | |

## finance/goals — meta financeira

| Campo | Tipo | Notas |
|---|---|---|
| `id` | texto | |
| `name`, `notes` | texto | |
| `target` | número | valor alvo |
| `deadline` | data \| null | |
| `monthly` | número | aporte mensal planejado |
| `accountIds` | texto[] | contas que somam para a meta |
| `manualCurrent` | número | usado só sem contas ligadas |
| `color` | hex | |

## vault/vault.enc.json — cofre

```json
{
  "schema": "planlife.vault", "version": 1,
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "salt": "<base64>" },
  "cipher": { "name": "AES-GCM", "length": 256, "iv": "<base64>", "aad": "planlife-vault-v1" },
  "twoFactor": { "type": "totp", "algorithm": "SHA1", "digits": 6, "period": 30 },
  "entries": 12,
  "data": "<base64 do conteúdo cifrado>"
}
```

Conteúdo decifrado (nunca gravado em disco): `{ "entries": [{ id, title, username, password, url, totp, notes, createdAt, updatedAt }], "twoFactor": { "secret" } }`.

## Migrando

1. Rode [`sql/001_init.sql`](sql/001_init.sql) (PostgreSQL; ajuste tipos para outro banco).
2. Para cada arquivo, leia `items[]` e insira na tabela da coluna acima. Campos array (`weekdays`, `ideas`, `accountIds`) vão para as tabelas de junção.
3. Junte todos os `routine/logs/*.json` em `routine_log`.
4. O cofre migra como blob (`vault.data`); continue decifrando no cliente.

Ou use *Ajustes → Exportar tudo*, que gera um único JSON com `files[<caminho>]` = conteúdo de cada arquivo.
