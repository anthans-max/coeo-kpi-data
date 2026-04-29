-- Coeo COGS schema (v1)
-- Run this once in the Supabase SQL Editor for the coeo-cogs project.
-- All tables prefixed `cogs_` to avoid collisions with other apps in the same project.

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Upload tracking
-- ----------------------------------------------------------------------------
create table if not exists cogs_uploads (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,        -- 'bandwidth' | 'peerless' | 'inteliquent' | 'revio_cdr' | 'revio_inventory' | 'razorflow_circuit'
  filename     text not null,
  row_count    integer not null default 0,
  uploaded_at  timestamptz not null default now(),
  period_start date,
  period_end   date
);

-- ----------------------------------------------------------------------------
-- Carrier CDR (voice cost — Bandwidth/Peerless/Inteliquent normalised)
-- ----------------------------------------------------------------------------
create table if not exists cogs_carrier_cdr (
  id              uuid primary key default gen_random_uuid(),
  upload_id       uuid references cogs_uploads(id) on delete cascade,
  carrier         text not null,     -- 'bandwidth' | 'peerless' | 'inteliquent'
  call_date       date not null,
  originating_tn  text,              -- normalised 10-digit
  terminating_tn  text not null,     -- normalised 10-digit — primary join key
  duration_sec    integer,
  carrier_cost    numeric(12,6) not null default 0,
  raw             jsonb              -- original row stored for traceability
);

create index if not exists cogs_carrier_cdr_terminating_tn_idx
  on cogs_carrier_cdr(terminating_tn);
create index if not exists cogs_carrier_cdr_carrier_call_date_idx
  on cogs_carrier_cdr(carrier, call_date);

-- ----------------------------------------------------------------------------
-- Rev.IO inventory (TN → customer mapping)
-- ----------------------------------------------------------------------------
create table if not exists cogs_revio_inventory (
  id                  uuid primary key default gen_random_uuid(),
  upload_id           uuid references cogs_uploads(id) on delete cascade,
  inventory_item_id   text,
  inventory_type_id   text,
  identifier_tn       text not null,   -- normalised 10-digit TN
  customer_id         text not null,
  status              text,
  snapshot_date       date
);

create index if not exists cogs_revio_inventory_identifier_tn_idx
  on cogs_revio_inventory(identifier_tn);
create index if not exists cogs_revio_inventory_customer_id_idx
  on cogs_revio_inventory(customer_id);

-- ----------------------------------------------------------------------------
-- Rev.IO rated CDR (revenue)
-- ----------------------------------------------------------------------------
create table if not exists cogs_revio_rated_cdr (
  id              uuid primary key default gen_random_uuid(),
  upload_id       uuid references cogs_uploads(id) on delete cascade,
  customer_id     text not null,
  cdr_id          text,
  call_date       date not null,
  product_type    text,
  charge          numeric(12,6) not null default 0,
  calling_number  text,    -- normalised 10-digit
  called_number   text,    -- normalised 10-digit
  duration_sec    integer,
  raw             jsonb
);

create index if not exists cogs_revio_rated_cdr_customer_id_idx
  on cogs_revio_rated_cdr(customer_id);
create index if not exists cogs_revio_rated_cdr_called_number_idx
  on cogs_revio_rated_cdr(called_number);
create index if not exists cogs_revio_rated_cdr_call_date_idx
  on cogs_revio_rated_cdr(call_date);

-- ----------------------------------------------------------------------------
-- RazorFlow circuit detail (circuit cost)
-- ----------------------------------------------------------------------------
create table if not exists cogs_circuit_cost (
  id              uuid primary key default gen_random_uuid(),
  upload_id       uuid references cogs_uploads(id) on delete cascade,
  circuit_id      text,              -- cid_condensed_ec_circuit
  invoice_number  text,
  invoice_date    date,
  customer_name   text,
  product_desc    text,
  state           text,
  billed_amount   numeric(12,2) not null default 0,
  mrc_from        date,
  mrc_thru        date,
  raw             jsonb
);

create index if not exists cogs_circuit_cost_circuit_id_idx
  on cogs_circuit_cost(circuit_id);
create index if not exists cogs_circuit_cost_invoice_date_idx
  on cogs_circuit_cost(invoice_date);

-- ----------------------------------------------------------------------------
-- Materialised result: voice CDR profitability (computed by Session 2)
-- ----------------------------------------------------------------------------
create table if not exists cogs_voice_profitability (
  id             uuid primary key default gen_random_uuid(),
  computed_at    timestamptz not null default now(),
  period_start   date,
  period_end     date,
  customer_id    text not null,
  carrier        text,
  call_count     integer not null default 0,
  total_revenue  numeric(12,6) not null default 0,
  total_cost     numeric(12,6) not null default 0,
  gross_profit   numeric(12,6) generated always as (total_revenue - total_cost) stored,
  gross_margin   numeric(6,4) generated always as (
    case when total_revenue > 0 then (total_revenue - total_cost) / total_revenue else 0 end
  ) stored
);

create index if not exists cogs_voice_profitability_customer_id_idx
  on cogs_voice_profitability(customer_id);
create index if not exists cogs_voice_profitability_period_idx
  on cogs_voice_profitability(period_start, period_end);

-- ----------------------------------------------------------------------------
-- Reconciliation log (match/gap tracking per upload run)
-- ----------------------------------------------------------------------------
create table if not exists cogs_reconciliation_log (
  id                   uuid primary key default gen_random_uuid(),
  computed_at          timestamptz not null default now(),
  carrier              text not null,
  total_cdrs           integer not null default 0,
  matched_cdrs         integer not null default 0,
  unmatched_cdrs       integer not null default 0,
  match_rate           numeric(6,4),
  zero_cost_rows       integer not null default 0,  -- Inteliquent call_charge=0 issue
  notes                text
);
