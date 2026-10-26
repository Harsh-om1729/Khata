-- SPEC §2.1: owner and staff have the same permissions. Owner-only: approving/removing phones
-- (already in 0002), staff management, and the UPI QR. Items and companies are archived, never
-- deleted. Settings changes are logged with phone and person.

-- Voids: anyone can void with a reason; no owner approval any more. --------------------------

drop trigger voids_owner_approves on public.voids;
drop function public.check_void_approver();
alter table public.voids drop column approved_by;

-- Items and companies: archive instead of delete. -------------------------------------------

alter table public.companies add column archived boolean not null default false;
alter table public.items add column archived boolean not null default false;
drop policy companies_owner_delete on public.companies;
drop policy items_owner_delete on public.items;
revoke delete, truncate on public.companies, public.items from authenticated;

-- Any approved phone edits any item, company or customer (last write wins). The original
-- policy only allowed the creating phone, which blocked e.g. staff changing an owner-added price.
-- device_id records who created the row, so no one may change it.
do $$
declare t text;
begin
  foreach t in array array['companies', 'items', 'customers'] loop
    execute format('drop policy %I_update on public.%I', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated
      using (public.can_access()) with check (public.can_access())', t, t);
    execute format('revoke update on public.%I from authenticated', t);
  end loop;
end $$;
grant update (name, picture, archived) on public.companies to authenticated;
grant update (company_id, name_hi, name_en, size, unit, price_paise, category, picture, needs_review, archived)
  on public.items to authenticated;
grant update (name, phone) on public.customers to authenticated;

-- Alerts are part of the live dashboard, which everyone sees (SPEC §6). ---------------------

alter table public.alerts drop constraint alerts_type_check;
alter table public.alerts add constraint alerts_type_check
  check (type in ('price_change', 'void', 'device_silent', 'upi_qr_change'));
drop policy alerts_owner_select on public.alerts;
create policy alerts_select on public.alerts for select to authenticated
  using (public.can_access());

-- Staff: owner-only management, PINs only through server functions. ------------------------

alter table public.staff
  add column pin_version integer not null default 1,
  add column removed_at timestamptz;

drop policy staff_owner_insert on public.staff;
drop policy staff_owner_update on public.staff;
drop policy staff_owner_delete on public.staff;

-- Nobody reads or writes staff directly except through the functions below; pin_hash is never
-- readable through the API (column privileges), not even by the owner.
revoke all on public.staff from authenticated;
grant select (id, device_id, name, photo, active, is_owner, pin_version, removed_at, created_at, server_at)
  on public.staff to authenticated;

create function public.check_pin_format(p_pin text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'a PIN must be exactly 4 digits' using errcode = '22023';
  end if;
end $$;

create function public.require_owner() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_owner() then
    raise exception 'only the owner can do this' using errcode = '42501';
  end if;
end $$;

create function public.add_staff(p_id uuid, p_name text, p_pin text, p_is_owner boolean default false,
  p_photo text default null, p_device_id uuid default null, p_created_at timestamptz default now())
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_owner();
  perform public.check_pin_format(p_pin);
  insert into public.staff (id, device_id, name, photo, pin_hash, is_owner, created_at)
  values (p_id, p_device_id, p_name, p_photo, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)),
    p_is_owner, p_created_at)
  on conflict (id) do nothing;
end $$;

create function public.update_staff(p_id uuid, p_name text, p_photo text, p_active boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_owner();
  update public.staff set name = p_name, photo = p_photo, active = p_active
  where id = p_id and removed_at is null;
  if not found then
    raise exception 'staff member not found or removed' using errcode = 'P0002';
  end if;
end $$;

create function public.reset_staff_pin(p_id uuid, p_new_pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_owner();
  perform public.check_pin_format(p_new_pin);
  update public.staff
  set pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 8)), pin_version = pin_version + 1
  where id = p_id and removed_at is null;
  if not found then
    raise exception 'staff member not found or removed' using errcode = 'P0002';
  end if;
end $$;

create function public.remove_staff(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.require_owner();
  update public.staff set removed_at = now(), active = false where id = p_id and removed_at is null;
  if not found then
    raise exception 'staff member not found or already removed' using errcode = 'P0002';
  end if;
end $$;

-- Any approved phone (or the owner) can change a PIN, but only with the current PIN.
create function public.change_own_pin(p_id uuid, p_old_pin text, p_new_pin text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  current_hash text;
begin
  if not public.can_access() then
    raise exception 'this phone is not approved' using errcode = '42501';
  end if;
  perform public.check_pin_format(p_new_pin);
  select pin_hash into current_hash from public.staff where id = p_id and removed_at is null;
  if current_hash is null or extensions.crypt(coalesce(p_old_pin, ''), current_hash) <> current_hash then
    raise exception 'wrong PIN' using errcode = '28P01';
  end if;
  update public.staff
  set pin_hash = extensions.crypt(p_new_pin, extensions.gen_salt('bf', 8)), pin_version = pin_version + 1
  where id = p_id;
end $$;

revoke execute on function public.check_pin_format(text), public.require_owner(),
  public.add_staff(uuid, text, text, boolean, text, uuid, timestamptz),
  public.update_staff(uuid, text, text, boolean), public.reset_staff_pin(uuid, text),
  public.remove_staff(uuid), public.change_own_pin(uuid, text, text)
  from public, anon;
grant execute on function public.add_staff(uuid, text, text, boolean, text, uuid, timestamptz),
  public.update_staff(uuid, text, text, boolean), public.reset_staff_pin(uuid, text),
  public.remove_staff(uuid), public.change_own_pin(uuid, text, text)
  to authenticated;

-- Shop settings. A change is an append-only settings_changes row (safe to resend by UUID);
-- a trigger records the old value and applies it to the single settings row. ----------------

create table public.settings (
  id boolean primary key default true check (id),
  shop_name text not null default '' check (length(shop_name) <= 80),
  -- GSTIN: 2-digit state, 10-character PAN, entity number, 'Z', check character.
  gstin text check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  upi_qr text,
  overdue_days integer not null default 30 check (overdue_days between 1 and 365),
  server_at timestamptz not null default now()
);
insert into public.settings default values;

create table public.settings_changes (
  id uuid primary key,
  device_id uuid not null references public.devices (id),
  staff_id uuid not null references public.staff (id),
  field text not null check (field in ('shop_name', 'gstin', 'upi_qr', 'overdue_days')),
  old_value text,
  new_value text,
  created_at timestamptz not null,
  server_at timestamptz not null default now()
);

create function public.apply_setting_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- A resent change (same UUID) must not apply an old value again or raise a second alert.
  -- BEFORE triggers run before the primary-key conflict is detected, so check here.
  if exists (select 1 from public.settings_changes where id = new.id) then
    return null;
  end if;
  case new.field
    when 'shop_name' then
      select shop_name into new.old_value from public.settings;
      update public.settings set shop_name = coalesce(new.new_value, ''), server_at = now() where id;
    when 'gstin' then
      select gstin into new.old_value from public.settings;
      update public.settings set gstin = nullif(upper(trim(new.new_value)), ''), server_at = now() where id;
    when 'upi_qr' then
      select upi_qr into new.old_value from public.settings;
      update public.settings set upi_qr = new.new_value, server_at = now() where id;
      insert into public.alerts (id, device_id, type, ref_id, created_at)
      values (gen_random_uuid(), new.device_id, 'upi_qr_change', new.id, new.created_at);
    when 'overdue_days' then
      select overdue_days::text into new.old_value from public.settings;
      update public.settings set overdue_days = new.new_value::integer, server_at = now() where id;
  end case;
  return new;
end $$;

create trigger settings_changes_server_at before insert on public.settings_changes
  for each row execute function public.set_server_at();
create trigger settings_changes_apply before insert on public.settings_changes
  for each row execute function public.apply_setting_change();
create trigger settings_changes_append_only before update or delete on public.settings_changes
  for each row execute function public.forbid_change();
create trigger settings_changes_no_truncate before truncate on public.settings_changes
  for each statement execute function public.forbid_change();

alter table public.settings enable row level security;
alter table public.settings_changes enable row level security;
revoke all on public.settings, public.settings_changes from anon;
revoke insert, update, delete, truncate on public.settings from authenticated;
revoke update, delete, truncate on public.settings_changes from authenticated;

create policy settings_select on public.settings for select to authenticated
  using (public.can_access());
create policy settings_changes_select on public.settings_changes for select to authenticated
  using (public.can_access());
-- The owner's email login has no device of its own, so it names the approved phone it is on.
create policy settings_changes_insert on public.settings_changes for insert to authenticated
  with check (
    (device_id = public.current_device_id()
      or (public.is_owner() and exists (
        select 1 from public.devices d where d.id = device_id and d.status = 'approved')))
    and (field <> 'upi_qr' or public.is_owner())
  );
