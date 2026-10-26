-- Row-level security (PLAN §5, DATA-SAFETY §2).
-- A phone signs in anonymously and is linked to one devices row. It gets access only while
-- the owner has that row approved; revoking it cuts off reads and writes at once.

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.owners where user_id = (select auth.uid()));
$$;

create function public.current_device_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.devices where auth_user_id = (select auth.uid()) and status = 'approved';
$$;

create function public.can_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_owner() or public.current_device_id() is not null;
$$;

revoke execute on function public.is_owner(), public.current_device_id(), public.can_access() from public, anon;
grant execute on function public.is_owner(), public.current_device_id(), public.can_access() to authenticated;

-- Signed-out visitors get nothing. Append-only tables cannot be updated, deleted or truncated
-- by any app role; the forbid_change triggers also stop the service key.
revoke all on all tables in schema public from anon;
revoke update, delete, truncate on public.price_changes, public.bills, public.bill_lines,
  public.payments, public.voids from authenticated;

alter table public.devices enable row level security;
alter table public.owners enable row level security;
alter table public.staff enable row level security;
alter table public.companies enable row level security;
alter table public.items enable row level security;
alter table public.customers enable row level security;
alter table public.alerts enable row level security;
alter table public.price_changes enable row level security;
alter table public.bills enable row level security;
alter table public.bill_lines enable row level security;
alter table public.payments enable row level security;
alter table public.voids enable row level security;

-- devices: a phone registers itself as pending and sees only its own row; the owner manages all.
create policy devices_select on public.devices for select to authenticated
  using (auth_user_id = (select auth.uid()) or public.is_owner());
create policy devices_register on public.devices for insert to authenticated
  with check (auth_user_id = (select auth.uid()) and status = 'pending' and code is null);
create policy devices_owner_update on public.devices for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy owners_select_self on public.owners for select to authenticated
  using (user_id = (select auth.uid()));

-- staff: phones read (PINs are checked on the phone); only the owner changes staff.
create policy staff_select on public.staff for select to authenticated
  using (public.can_access());
create policy staff_owner_insert on public.staff for insert to authenticated
  with check (public.is_owner());
create policy staff_owner_update on public.staff for update to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy staff_owner_delete on public.staff for delete to authenticated
  using (public.is_owner());

-- companies, items, customers: any approved phone or the owner can add and edit (SPEC §3.1A).
do $$
declare t text;
begin
  foreach t in array array['companies', 'items', 'customers'] loop
    execute format('create policy %I_select on public.%I for select to authenticated
      using (public.can_access())', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated
      with check (device_id = public.current_device_id() or (device_id is null and public.is_owner()))', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated
      using (public.can_access())
      with check (device_id is not distinct from public.current_device_id() or public.is_owner())', t, t);
  end loop;
end $$;

create policy companies_owner_delete on public.companies for delete to authenticated
  using (public.is_owner());
create policy items_owner_delete on public.items for delete to authenticated
  using (public.is_owner());

-- alerts: phones raise them; the owner reads them and marks them seen.
create policy alerts_insert on public.alerts for insert to authenticated
  with check (device_id = public.current_device_id() or (device_id is null and public.is_owner()));
create policy alerts_owner_select on public.alerts for select to authenticated
  using (public.is_owner());
create policy alerts_owner_update on public.alerts for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Append-only records: read by approved phones and the owner; inserted only as the phone itself.
-- There are deliberately no update or delete policies.
do $$
declare t text;
begin
  foreach t in array array['price_changes', 'bills', 'bill_lines', 'payments', 'voids'] loop
    execute format('create policy %I_select on public.%I for select to authenticated
      using (public.can_access())', t, t);
  end loop;
end $$;

create policy price_changes_insert on public.price_changes for insert to authenticated
  with check (device_id = public.current_device_id());
create policy bills_insert on public.bills for insert to authenticated
  with check (device_id = public.current_device_id());
create policy voids_insert on public.voids for insert to authenticated
  with check (device_id = public.current_device_id());

-- Lines and sale payments must belong to a bill made on the same phone.
create policy bill_lines_insert on public.bill_lines for insert to authenticated
  with check (
    device_id = public.current_device_id()
    and exists (select 1 from public.bills b where b.id = bill_id and b.device_id = public.current_device_id())
  );
create policy payments_insert on public.payments for insert to authenticated
  with check (
    device_id = public.current_device_id()
    and (bill_id is null
      or exists (select 1 from public.bills b where b.id = bill_id and b.device_id = public.current_device_id()))
  );
