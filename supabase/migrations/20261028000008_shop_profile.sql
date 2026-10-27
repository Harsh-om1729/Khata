-- U-1: shop profile fields (SPEC §2.1), set through settings_changes like the other settings.

alter table public.settings
  add column phone1 text check (phone1 ~ '^[1-9][0-9]{9}$'),
  add column phone2 text check (phone2 ~ '^[1-9][0-9]{9}$'),
  add column address text check (length(address) <= 200),
  add column pincode text check (pincode ~ '^[1-9][0-9]{5}$'),
  -- GST state code, the same two digits a GSTIN starts with.
  add column state text check (state ~ '^[0-9]{2}$');

alter table public.settings_changes drop constraint settings_changes_field_check;
alter table public.settings_changes add constraint settings_changes_field_check check (field in (
  'shop_name', 'gstin', 'upi_qr', 'overdue_days', 'phone1', 'phone2', 'address', 'pincode', 'state'));

create or replace function public.apply_setting_change() returns trigger
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
    when 'phone1' then
      select phone1 into new.old_value from public.settings;
      update public.settings set phone1 = nullif(trim(new.new_value), ''), server_at = now() where id;
    when 'phone2' then
      select phone2 into new.old_value from public.settings;
      update public.settings set phone2 = nullif(trim(new.new_value), ''), server_at = now() where id;
    when 'address' then
      select address into new.old_value from public.settings;
      update public.settings set address = nullif(trim(new.new_value), ''), server_at = now() where id;
    when 'pincode' then
      select pincode into new.old_value from public.settings;
      update public.settings set pincode = nullif(trim(new.new_value), ''), server_at = now() where id;
    when 'state' then
      select state into new.old_value from public.settings;
      update public.settings set state = nullif(trim(new.new_value), ''), server_at = now() where id;
  end case;
  return new;
end $$;
