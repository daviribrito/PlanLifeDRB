-- PlanLife: esquema relacional equivalente aos arquivos JSON de data/ (schema version 1).
-- PostgreSQL. Cada tabela corresponde a um arquivo; arrays viram tabelas de junção.

CREATE TABLE settings (
  id              smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  profile_name    text,
  day_start       time NOT NULL DEFAULT '06:00',
  day_end         time NOT NULL DEFAULT '23:00',
  week_start      smallint NOT NULL DEFAULT 1,
  ai_provider     text,
  ai_model        text,
  ai_base_url     text,
  google_client_id text,
  google_calendar_ids text[] NOT NULL DEFAULT ARRAY['primary'],
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE focus_mode (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  description text,
  color       char(7) NOT NULL,
  ai_brief    text,
  builtin     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL
);

CREATE TABLE focus_mode_idea (
  mode_id  text NOT NULL REFERENCES focus_mode(id) ON DELETE CASCADE,
  position smallint NOT NULL,
  idea     text NOT NULL,
  PRIMARY KEY (mode_id, position)
);

CREATE TABLE focus_cycle (
  id          text PRIMARY KEY,
  mode_id     text NOT NULL REFERENCES focus_mode(id),
  kind        text NOT NULL CHECK (kind IN ('month', 'week', 'custom')),
  start_date  date NOT NULL,
  end_date    date NOT NULL CHECK (end_date >= start_date),
  goal        text,
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL
);

CREATE TABLE focus_cycle_weekday (
  cycle_id text NOT NULL REFERENCES focus_cycle(id) ON DELETE CASCADE,
  weekday  smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  PRIMARY KEY (cycle_id, weekday)
);

CREATE TABLE routine_block (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  start_time  time NOT NULL,
  end_time    time NOT NULL CHECK (end_time > start_time),
  mode_id     text REFERENCES focus_mode(id) ON DELETE SET NULL,
  notes       text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL
);

CREATE TABLE routine_block_weekday (
  block_id text NOT NULL REFERENCES routine_block(id) ON DELETE CASCADE,
  weekday  smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  PRIMARY KEY (block_id, weekday)
);

CREATE TABLE routine_log (
  id        text PRIMARY KEY,               -- <date>_<blockId>
  date      date NOT NULL,
  block_id  text NOT NULL REFERENCES routine_block(id) ON DELETE CASCADE,
  status    text NOT NULL CHECK (status IN ('done', 'skipped')),
  at        timestamptz NOT NULL,
  UNIQUE (date, block_id)
);

CREATE TABLE ai_suggestion (
  id            text PRIMARY KEY,
  date          date NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('task', 'question')),
  mode_id       text REFERENCES focus_mode(id) ON DELETE SET NULL,
  title         text NOT NULL,
  detail        text,
  start_time    time,
  duration_min  smallint NOT NULL DEFAULT 30,
  status        text NOT NULL CHECK (status IN ('pending', 'accepted', 'done', 'rejected', 'answered')),
  answer        text,
  source_provider text,
  source_model  text,
  calendar      boolean NOT NULL DEFAULT false,
  decided_at    timestamptz,
  created_at    timestamptz NOT NULL,
  updated_at    timestamptz NOT NULL
);
CREATE INDEX ai_suggestion_date_idx ON ai_suggestion (date, status);

CREATE TABLE finance_account (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  type          text NOT NULL CHECK (type IN ('reserva','poupanca','renda_fixa','fundos','acoes','fii','exterior','previdencia','cripto','conta','outro')),
  institution   text,
  balance       numeric(14,2) NOT NULL DEFAULT 0,
  balance_date  date,
  notes         text,
  created_at    timestamptz NOT NULL,
  updated_at    timestamptz NOT NULL
);

CREATE TABLE finance_snapshot (
  id          text PRIMARY KEY,             -- <accountId>_<date>
  account_id  text NOT NULL REFERENCES finance_account(id) ON DELETE CASCADE,
  date        date NOT NULL,
  balance     numeric(14,2) NOT NULL,
  created_at  timestamptz NOT NULL,
  UNIQUE (account_id, date)
);

CREATE TABLE finance_goal (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  target          numeric(14,2) NOT NULL CHECK (target > 0),
  deadline        date,
  monthly         numeric(14,2) NOT NULL DEFAULT 0,
  manual_current  numeric(14,2) NOT NULL DEFAULT 0,
  color           char(7),
  notes           text,
  created_at      timestamptz NOT NULL,
  updated_at      timestamptz NOT NULL
);

CREATE TABLE finance_goal_account (
  goal_id     text NOT NULL REFERENCES finance_goal(id) ON DELETE CASCADE,
  account_id  text NOT NULL REFERENCES finance_account(id) ON DELETE CASCADE,
  PRIMARY KEY (goal_id, account_id)
);

-- O cofre migra cifrado: a decifração continua no cliente.
CREATE TABLE vault (
  id              smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  kdf_name        text NOT NULL,
  kdf_hash        text NOT NULL,
  kdf_iterations  integer NOT NULL,
  kdf_salt        text NOT NULL,
  cipher_name     text NOT NULL,
  cipher_iv       text NOT NULL,
  cipher_aad      text,
  entries         integer NOT NULL DEFAULT 0,
  data            text NOT NULL,
  created_at      timestamptz NOT NULL,
  updated_at      timestamptz NOT NULL
);
