-- M0-7: a staff member's first PIN login on a phone is checked here. Returns the current
-- pin_version (never the hash), which the phone stores beside its own offline PBKDF2 hash.
create function public.verify_staff_pin(p_id uuid, p_pin text) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  member record;
begin
  if not public.can_access() then
    raise exception 'this phone is not approved' using errcode = '42501';
  end if;
  select pin_hash, pin_version into member
  from public.staff where id = p_id and removed_at is null and active;
  if member.pin_hash is null
    or extensions.crypt(coalesce(p_pin, ''), member.pin_hash) <> member.pin_hash then
    raise exception 'wrong PIN' using errcode = '28P01';
  end if;
  return member.pin_version;
end $$;

revoke execute on function public.verify_staff_pin(uuid, text) from public, anon;
grant execute on function public.verify_staff_pin(uuid, text) to authenticated;
