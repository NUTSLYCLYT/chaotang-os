-- 朝堂 OS · Operating Loop database boundary
-- Target: Postgres / Neon / Supabase
-- Keep API contracts stable while replacing .chaotang/build-ledger.json.

create table if not exists build_ledger (
  id text primary key,
  task_id text not null,
  title text not null,
  command text not null,
  source text,
  suggestion text,
  evidence jsonb not null default '[]'::jsonb,
  ministers jsonb not null default '[]'::jsonb,
  status text not null default 'dispatched'
    check (status in ('dispatched', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists build_ledger_task_id_idx on build_ledger(task_id);
create index if not exists build_ledger_created_at_idx on build_ledger(created_at desc);

create table if not exists build_budgets (
  id text primary key,
  title text not null,
  target_dept text not null,
  owner_dept text not null,
  status text not null
    check (status in ('pending_review', 'approved', 'needs_rework')),
  requested_budget text not null,
  estimated_roi text not null,
  payback_window text not null,
  cashflow_pressure text not null,
  priority text not null check (priority in ('P0', 'P1', 'P2')),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  recommendation text not null,
  command text not null,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  assigned_windows jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists build_retrospectives (
  id text primary key,
  source_budget_id text,
  task_id text,
  title text not null,
  score integer not null check (score >= 0 and score <= 100),
  grade text not null check (grade in ('优', '良', '中')),
  outcome text not null,
  evidence jsonb not null default '[]'::jsonb,
  risk_notes jsonb not null default '[]'::jsonb,
  next_suggestion text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists build_retrospectives_task_id_idx on build_retrospectives(task_id);
create index if not exists build_retrospectives_source_budget_id_idx on build_retrospectives(source_budget_id);

create table if not exists operating_signals (
  id text primary key,
  type text not null
    check (type in ('risk', 'opportunity', 'decision_needed', 'execution_followup')),
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  source text not null,
  title text not null,
  summary text not null,
  evidence jsonb not null default '[]'::jsonb,
  recommended_action text not null,
  status text not null default 'open' check (status in ('open', 'dismissed', 'converted', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operating_signals_status_idx on operating_signals(status);
create index if not exists operating_signals_created_at_idx on operating_signals(created_at desc);

create table if not exists audit_events (
  id text primary key,
  actor_id text,
  actor_role text,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_entity_idx on audit_events(entity_type, entity_id);
create index if not exists audit_events_created_at_idx on audit_events(created_at desc);
