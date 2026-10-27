-- M0-6c: phones are never deleted (bills reference them) and a bill letter, once given, never
-- changes, so it can never be reused by another phone, even after the phone is turned off.

create function public.forbid_device_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'phones are never deleted; turn the phone off instead' using errcode = 'P0001';
end $$;

create function public.keep_device_code() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.code is not null and new.code is distinct from old.code then
    raise exception 'a bill letter never changes once given' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger devices_no_delete before delete on public.devices
  for each row execute function public.forbid_device_delete();
create trigger devices_keep_code before update on public.devices
  for each row execute function public.keep_device_code();
revoke delete, truncate on public.devices from authenticated;

-- Minimal "last seen" for the owner's phone list; M3-4 adds unsynced_count and clock drift.
-- Works for pending and turned-off phones too, so the owner sees when a phone was last opened.
create function public.device_seen() returns void
language sql security definer set search_path = '' as $$
  update public.devices set last_seen = now() where auth_user_id = (select auth.uid());
$$;

revoke execute on function public.forbid_device_delete(), public.keep_device_code() from public, anon, authenticated;
revoke execute on function public.device_seen() from public, anon;
grant execute on function public.device_seen() to authenticated;

create trigger devices_no_truncate before truncate on public.devices
  for each statement execute function public.forbid_device_delete();
