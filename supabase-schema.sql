create table if not exists public.profiles (
  id text not null primary key,
  auth_user_id uuid,
  email text not null unique,
  name text not null,
  role text not null default 'member',
  notifications_enabled boolean not null default true,
  allowed_tabs jsonb not null default '[]'::jsonb,
  mobile_quick_tabs jsonb not null default '[]'::jsonb,
  officer_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.categories (
  id text not null primary key,
  name text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.products (
  id text not null primary key,
  name text not null,
  version text,
  category_id text,
  retail_price numeric not null default 0,
  commission numeric not null default 0,
  status text not null default 'active',
  dhaka integer not null default 0,
  chittagong integer not null default 0,
  slabs jsonb not null default '[]'::jsonb,
  sort_order integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.dealers (
  id text not null primary key,
  name text not null,
  address text,
  phone text,
  officer_name text,
  balance numeric not null default 0,
  officer_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.officers (
  id text not null primary key,
  name text not null,
  phone text,
  designation text,
  commission_balance numeric not null default 0,
  clearance_history jsonb not null default '[]'::jsonb,
  commission_tokens jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.orders (
  id text not null primary key,
  date text not null,
  type text not null,
  status text not null,
  customer_name text,
  dealer_id text,
  customer_phone text,
  customer_address text,
  officer text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  extra numeric not null default 0,
  net_total numeric not null default 0,
  notes text,
  created_by text,
  approved_by text,
  is_quote boolean not null default false,
  retail_payment_status text,
  partial_amount numeric,
  retail_payment_date text,
  payment_reference text,
  include_price_increase_in_commission boolean not null default false,
  inventory_source text,
  show_serials_on_invoice boolean not null default false,
  shipping jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payments (
  id text not null primary key,
  dealer_id text,
  dealer_name text,
  date text not null,
  type text not null,
  amount numeric not null default 0,
  reference text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.retail_transactions (
  id text not null primary key,
  order_id text,
  date text not null,
  detail text,
  amount numeric not null default 0,
  payment_status text,
  paid_amount numeric,
  location text,
  type text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.product_stock_entries (
  id text not null primary key,
  entry_id text,
  batch_id text,
  product_id text,
  product_name text,
  date text not null,
  location text not null,
  quantity integer not null,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.product_stock_transfers (
  id text not null primary key,
  transfer_id text,
  date text not null,
  product_id text,
  product_name text,
  from_location text not null,
  to_location text not null,
  quantity integer not null,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.targets (
  id text not null primary key,
  name text,
  dealer_id text,
  dealer_name text,
  type text not null,
  product_ids jsonb not null default '[]'::jsonb,
  target_value numeric not null default 0,
  current_value numeric not null default 0,
  start_date text,
  end_date text,
  reward_type text,
  reward_value numeric not null default 0,
  status text not null,
  assigned_officer_id text,
  rewarded_dealer_ids jsonb not null default '[]'::jsonb,
  reward_disbursed jsonb not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.target_rewards (
  id text not null primary key,
  reward_ref text,
  target_id text,
  target_name text,
  dealer_id text,
  dealer_name text,
  officer_id text,
  officer_name text,
  date text not null,
  cycles integer not null default 0,
  amount numeric not null default 0,
  payment_id text,
  note text,
  status text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id text not null primary key,
  user_id text not null,
  title text,
  message text,
  type text,
  read boolean not null default false,
  timestamp text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customization (
  id text not null primary key,
  title text not null,
  logo text,
  sidebar_color text not null,
  main_color text not null,
  initial_retail_amount numeric not null default 0,
  initial_retail_amount_dhaka numeric,
  initial_retail_amount_chittagong numeric,
  regards text,
  exec_name text,
  exec_details text,
  custom_detail_text text,
  custom_detail_html text,
  custom_detail_bold boolean not null default false,
  custom_detail_italic boolean not null default false,
  custom_detail_boxed boolean not null default false,
  order_serial_seed text,
  quote_serial_seed text,
  payment_reference_seed text,
  parcel_names jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.send_amounts (
  id text not null primary key,
  date text not null,
  location text not null,
  amount numeric not null default 0,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.counters (
  key text not null primary key,
  value integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.dealers enable row level security;
alter table public.officers enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.retail_transactions enable row level security;
alter table public.product_stock_entries enable row level security;
alter table public.product_stock_transfers enable row level security;
alter table public.targets enable row level security;
alter table public.target_rewards enable row level security;
alter table public.notifications enable row level security;
alter table public.customization enable row level security;
alter table public.counters enable row level security;
alter table public.send_amounts enable row level security;

-- Policies (DROP and CREATE for idempotency)
drop policy if exists "Allow authenticated select" on public.profiles;
drop policy if exists "Allow authenticated write" on public.profiles;
create policy "Allow public select" on public.profiles for select using (true);
create policy "Allow public write" on public.profiles for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.categories;
drop policy if exists "Allow authenticated write" on public.categories;
drop policy if exists "Allow public select" on public.categories;
drop policy if exists "Allow public write" on public.categories;
create policy "Allow public select" on public.categories for select using (true);
create policy "Allow public write" on public.categories for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.products;
drop policy if exists "Allow authenticated write" on public.products;
drop policy if exists "Allow public select" on public.products;
drop policy if exists "Allow public write" on public.products;
create policy "Allow public select" on public.products for select using (true);
create policy "Allow public write" on public.products for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.dealers;
drop policy if exists "Allow authenticated write" on public.dealers;
drop policy if exists "Allow public select" on public.dealers;
drop policy if exists "Allow public write" on public.dealers;
create policy "Allow public select" on public.dealers for select using (true);
create policy "Allow public write" on public.dealers for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.officers;
drop policy if exists "Allow authenticated write" on public.officers;
drop policy if exists "Allow public select" on public.officers;
drop policy if exists "Allow public write" on public.officers;
create policy "Allow public select" on public.officers for select using (true);
create policy "Allow public write" on public.officers for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.orders;
drop policy if exists "Allow authenticated write" on public.orders;
drop policy if exists "Allow public select" on public.orders;
drop policy if exists "Allow public write" on public.orders;
create policy "Allow public select" on public.orders for select using (true);
create policy "Allow public write" on public.orders for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.payments;
drop policy if exists "Allow authenticated write" on public.payments;
drop policy if exists "Allow public select" on public.payments;
drop policy if exists "Allow public write" on public.payments;
create policy "Allow public select" on public.payments for select using (true);
create policy "Allow public write" on public.payments for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.retail_transactions;
drop policy if exists "Allow authenticated write" on public.retail_transactions;
drop policy if exists "Allow public select" on public.retail_transactions;
drop policy if exists "Allow public write" on public.retail_transactions;
create policy "Allow public select" on public.retail_transactions for select using (true);
create policy "Allow public write" on public.retail_transactions for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.product_stock_entries;
drop policy if exists "Allow authenticated write" on public.product_stock_entries;
drop policy if exists "Allow public select" on public.product_stock_entries;
drop policy if exists "Allow public write" on public.product_stock_entries;
create policy "Allow public select" on public.product_stock_entries for select using (true);
create policy "Allow public write" on public.product_stock_entries for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.product_stock_transfers;
drop policy if exists "Allow authenticated write" on public.product_stock_transfers;
drop policy if exists "Allow public select" on public.product_stock_transfers;
drop policy if exists "Allow public write" on public.product_stock_transfers;
create policy "Allow public select" on public.product_stock_transfers for select using (true);
create policy "Allow public write" on public.product_stock_transfers for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.targets;
drop policy if exists "Allow authenticated write" on public.targets;
drop policy if exists "Allow public select" on public.targets;
drop policy if exists "Allow public write" on public.targets;
create policy "Allow public select" on public.targets for select using (true);
create policy "Allow public write" on public.targets for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.target_rewards;
drop policy if exists "Allow authenticated write" on public.target_rewards;
drop policy if exists "Allow public select" on public.target_rewards;
drop policy if exists "Allow public write" on public.target_rewards;
create policy "Allow public select" on public.target_rewards for select using (true);
create policy "Allow public write" on public.target_rewards for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.notifications;
drop policy if exists "Allow authenticated write" on public.notifications;
drop policy if exists "Allow public select" on public.notifications;
drop policy if exists "Allow public write" on public.notifications;
create policy "Allow public select" on public.notifications for select using (true);
create policy "Allow public write" on public.notifications for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.customization;
drop policy if exists "Allow authenticated write" on public.customization;
drop policy if exists "Allow public select" on public.customization;
drop policy if exists "Allow public write" on public.customization;
create policy "Allow public select" on public.customization for select using (true);
create policy "Allow public write" on public.customization for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.counters;
drop policy if exists "Allow authenticated write" on public.counters;
drop policy if exists "Allow public select" on public.counters;
drop policy if exists "Allow public write" on public.counters;
create policy "Allow public select" on public.counters for select using (true);
create policy "Allow public write" on public.counters for all using (true) with check (true);

drop policy if exists "Allow authenticated select" on public.send_amounts;
drop policy if exists "Allow authenticated write" on public.send_amounts;
drop policy if exists "Allow public select" on public.send_amounts;
drop policy if exists "Allow public write" on public.send_amounts;
create policy "Allow public select" on public.send_amounts for select using (true);
create policy "Allow public write" on public.send_amounts for all using (true) with check (true);
