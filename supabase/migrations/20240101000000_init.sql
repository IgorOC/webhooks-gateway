create table webhook_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  secret text not null,
  signature_header text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references webhook_sources(id) on delete cascade,
  event_id text not null,
  event_type text not null,
  signature text not null,
  payload jsonb not null,
  headers jsonb not null,
  status text check (status in ('received','verified','processed','failed')) default 'received',
  error_message text,
  retry_count integer default 0,
  received_at timestamptz default now(),
  processed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index on webhook_events(source_id, event_id);

create function increment_retry_count(event_id uuid)
returns void as $$
begin
  update webhook_events 
  set retry_count = retry_count + 1,
      updated_at = now()
  where id = event_id;
end;
$$ language plpgsql;

insert into webhook_sources (name, secret, signature_header) values
('stripe', 'your-stripe-webhook-secret', 'stripe-signature'),
('github', 'your-github-webhook-secret', 'x-hub-signature-256'),
('resend', 'your-resend-webhook-secret', 'resend-signature');