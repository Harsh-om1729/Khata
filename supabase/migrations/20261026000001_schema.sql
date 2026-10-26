-- Khata schema (PLAN §3). Money is always bigint paise. Every row id is a UUID made on the phone.
-- created_at is the phone's clock; server_at is always set by the server (see set_server_at).

create function public.set_server_at() returns trigger
language plpgsql as $$
begin
  new.server_at := now();
  return new;
end $$;

create function public.forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only: rows can never be changed or deleted', tg_table_name
    using errcode = 'P0001';
end $$;

-- Devices and owners ---------------------------------------------------------

create table public.devices (
  id uuid primary key,
  auth_user_id uuid not null unique references auth.users (id),
  name text not null check (length(name) between 1 and 60),
  -- Short code used in bill numbers (e.g. "A" in A-261026-007); given by the owner on approval.
  code text unique check (code ~ '^[A-Z][A-Z0-9]{0,2}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  last_seen timestamptz,
  unsynced_count integer not null default 0 check (unsynced_count >= 0),
  created_at timestamptz not null,
  server_at timestamptz not null default now(),
  check (status <> 'approved' or code is not null)
);

create table public.owners (
  user_id uuid primary key references auth.users (id),
  created_at timestamptz not null default now()
);

-- Reference data (editable, last write wins) ---------------------------------

create table public.staff (
  id uuid primary key,
  device_id uuid references public.devices (id),
  name text not null check (length(name) between 1 and 60),
  photo text,
  pin_hash text not null,
  active boolean not null default true,
  is_owner boolean not null default false,
  created_at timestamptz not null,
  server_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key,
  device_id uuid references public.devices (id),
  name text not null check (length(name) between 1 and 80),
  picture text,
  created_at timestamptz not null,
  server_at timestamptz not null default now()
);
create unique index companies_name_key on public.companies (lower(name));

create table public.items (
  id uuid primary key,
  device_id uuid references public.devices (id),
  company_id uuid not null references public.companies (id),
  name_hi text not null default '',
  name_en text not null default '',
  size text not null default '',
  unit text not null default 'piece' check (unit in ('piece', 'kg', 'metre', 'bag')),
  price_paise bigint not null check (price_paise >= 0),
  category text not null default '',
  picture text,
  needs_review boolean not null default false,
  created_at timestamptz not null,
  server_at timestamptz not null default now(),
  check (name_hi <> '' or name_en <> '')
);
-- Natural key from SPEC §3.1B: Company + Item name + Size.
create unique index items_natural_key on public.items
  (company_id, lower(coalesce(nullif(name_en, ''), name_hi)), lower(size));

create table public.customers (
  id uuid primary key,
  device_id uuid references public.devices (id),
  name text not null check (length(name) between 1 and 80),
  phone text check (phone ~ '^[0-9]{10}$'),
  created_at timestamptz not null,
  server_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key,
  device_id uuid references public.devices (id),
  type text not null check (type in ('price_change', 'void', 'device_silent')),
  ref_id uuid,
  seen boolean not null default false,
  created_at timestamptz not null,
  server_at timestamptz not null default now()
);

-- Append-only records ---------------------------------------------------------

create table public.price_changes (
  id uuid primary key,
  device_id uuid not null references public.devices (id),
  item_id uuid not null references public.items (id),
  staff_id uuid not null references public.staff (id),
  old_paise bigint not null check (old_paise >= 0),
  new_paise bigint not null check (new_paise >= 0),
  created_at timestamptz not null,
  server_at timestamptz not null default now()
);

create table public.bills (
  id uuid primary key,
  device_id uuid not null references public.devices (id),
  bill_no text not null,
  staff_id uuid not null references public.staff (id),
  customer_id uuid references public.customers (id),
  total_paise bigint not null,
  kind text not null default 'sale' check (kind in ('sale', 'return')),
  linked_bill_id uuid references public.bills (id),
  created_at timestamptz not null,
  server_at timestamptz not null default now(),
  unique (device_id, bill_no),
  check (
    (kind = 'sale' and total_paise >= 0 and linked_bill_id is null)
    or (kind = 'return' and total_paise <= 0 and linked_bill_id is not null)
  )
);

create table public.bill_lines (
  id uuid primary key,
  device_id uuid not null references public.devices (id),
  bill_id uuid not null references public.bills (id),
  item_id uuid not null references public.items (id),
  name text not null,
  qty numeric(10, 3) not null check (qty <> 0),
  unit_price_paise bigint not null check (unit_price_paise >= 0),
  line_total_paise bigint not null,
  created_at timestamptz not null,
  server_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key,
  device_id uuid not null references public.devices (id),
  bill_id uuid references public.bills (id),
  customer_id uuid references public.customers (id),
  staff_id uuid not null references public.staff (id),
  method text not null check (method in ('cash', 'upi', 'udhaar')),
  type text not null check (type in ('sale', 'repayment', 'opening')),
  amount_paise bigint not null check (amount_paise > 0),
  created_at timestamptz not null,
  server_at timestamptz not null default now(),
  check (type <> 'sale' or bill_id is not null),
  check (type = 'sale' or (bill_id is null and customer_id is not null)),
  check (method <> 'udhaar' or customer_id is not null),
  check (type <> 'opening' or method = 'udhaar'),
  check (type <> 'repayment' or method in ('cash', 'upi'))
);

create table public.voids (
  id uuid primary key,
  device_id uuid not null references public.devices (id),
  bill_id uuid not null unique references public.bills (id),
  staff_id uuid not null references public.staff (id),
  approved_by uuid not null references public.staff (id),
  reason text not null check (length(trim(reason)) > 0),
  created_at timestamptz not null,
  server_at timestamptz not null default now()
);

create function public.check_void_approver() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.staff where id = new.approved_by and is_owner) then
    raise exception 'a void must be approved by the owner' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger voids_owner_approves before insert on public.voids
  for each row execute function public.check_void_approver();

-- Triggers: server time, and append-only enforcement that even the service key cannot bypass.

do $$
declare t text;
begin
  foreach t in array array['devices', 'staff', 'companies', 'items', 'customers', 'alerts'] loop
    execute format('create trigger %I_server_at before insert or update on public.%I
      for each row execute function public.set_server_at()', t, t);
  end loop;

  foreach t in array array['price_changes', 'bills', 'bill_lines', 'payments', 'voids'] loop
    execute format('create trigger %I_server_at before insert on public.%I
      for each row execute function public.set_server_at()', t, t);
    execute format('create trigger %I_append_only before update or delete on public.%I
      for each row execute function public.forbid_change()', t, t);
    execute format('create trigger %I_no_truncate before truncate on public.%I
      for each statement execute function public.forbid_change()', t, t);
  end loop;
end $$;

-- Derived views (security_invoker so the caller's row-level rules apply) -----

-- A bill's status is never stored on the bill: it is voided when a voids row exists.
create view public.bills_with_status with (security_invoker = true) as
select b.*,
  case when v.id is null then 'active' else 'voided' end as status,
  v.id as void_id
from public.bills b
left join public.voids v on v.bill_id = b.id;

-- Udhaar balance = opening + udhaar sales - repayments, from payments only.
-- Udhaar on a voided bill no longer counts.
create view public.customer_balances with (security_invoker = true) as
select c.id as customer_id,
  coalesce(sum(
    case
      when p.method = 'udhaar' then p.amount_paise
      when p.type = 'repayment' then -p.amount_paise
      else 0
    end), 0)::bigint as balance_paise,
  max(p.created_at) filter (where p.type = 'repayment') as last_repayment_at
from public.customers c
left join public.payments p
  on p.customer_id = c.id
  and not exists (select 1 from public.voids v where v.bill_id = p.bill_id)
group by c.id;
