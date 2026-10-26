-- Security advisor: Supabase grants EXECUTE on new functions to anon and authenticated by
-- default. These are internal (trigger functions and helpers used inside other functions),
-- so no API role needs to call them directly.
revoke execute on function
  public.apply_setting_change(),
  public.set_server_at(),
  public.forbid_change(),
  public.require_owner(),
  public.check_pin_format(text)
from public, anon, authenticated;
