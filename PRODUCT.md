# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JavaScript (ES modules, no build step, no Node). Local editing via a PowerShell `HttpListener` server (`serve.ps1`) that ships with Windows and writes JSON files under `/data`. Published read-only on GitHub Pages. Chosen by the user ("zero instalação").

## Users

A single person (the owner, Davi) managing their own life: daily routine, calendar, savings/investment goals and passwords. Uses it mainly on a desktop PC; edits happen on the PC, then commit/push to GitHub so the same data follows them to another machine.

## Product Purpose

PlanLife is a personal life-management system: one place to hold the main routine, see the Google Calendar, track progress on financial goals (savings and investments, not expense bookkeeping), and keep passwords in an encrypted vault. Success means the owner opens it daily, follows the routine, and uses focus modes to steadily improve chosen areas.

## Positioning

Focus modes: the owner assigns a focus (e.g. Saúde Física, Inglês, Estudos da área, Organização Financeira) to a week, a month, or specific days. The main routine never changes; an AI assistant (provider-agnostic: OpenAI, Anthropic, Google) proposes viable extras around existing tasks and commitments, and can ask the owner questions ("com o que você mais gastou nos últimos 2 meses?"). The owner accepts or rejects every suggestion.

## Operating Context

- Daily check of today's routine and calendar; weekly planning of focus modes.
- Data lives as organized JSON files in the repository, structured so it can be migrated to a database later.
- Git is used for sync/backup between PCs. GitHub Pages serves a read-only copy.

## Capabilities and Constraints

- Routine: recurring blocks per weekday, daily completion log.
- Calendar: Google Calendar integration (OAuth client-side, user supplies Client ID).
- Finance: accounts/buckets (savings, investments), goals with targets and deadlines, balance snapshots over time.
- Vault: master password (PBKDF2 → AES-256-GCM) plus TOTP 2FA with an authenticator app. Encrypted vault file is committed to the repo.
- AI: bring-your-own API key; keys stay on the device (never committed).
- No server-side database. Writes only work through the local server; GitHub Pages is read-only.
- Open: whether non-vault data should be encrypted when the Pages site is public.

## Product Principles

1. The owner's routine is the anchor; AI only suggests, never rewrites.
2. Every piece of data is a plain, documented file the owner can read, diff, and migrate.
3. Security is honest: real encryption for secrets, no false promises about what client-side 2FA guarantees.
4. Calm daily use beats feature density: today first, everything else one step away.
