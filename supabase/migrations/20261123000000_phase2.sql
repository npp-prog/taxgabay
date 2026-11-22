-- Phase 2: checklist item details, reminders (push subscriptions, send log).

alter table public.checklist_items
  add column detail text,
  add column months text check (months in ('non_quarter_end', 'quarter_end')),
  add column quarters int[],
  add column due_hint text,
  add column legal_basis text,
  add column needs_verification boolean not null default true;

-- Web push subscriptions (one row per browser/device).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "push_subscriptions: owner" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Idempotency log for the reminder job (service role only; users can read their own).
create table public.reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_key text not null, -- "<obligation id>:<days before>"
  channel text not null check (channel in ('email', 'push')),
  sent_at timestamptz not null default now(),
  primary key (user_id, reminder_key, channel)
);
alter table public.reminder_log enable row level security;
create policy "reminder_log: owner read" on public.reminder_log for select using (auth.uid() = user_id);
