-- Security advisor (lint 0011): pin search_path on trigger functions so a role cannot
-- shadow the objects they use. They reference tables with explicit public. names.
alter function public.set_server_at() set search_path = '';
alter function public.forbid_change() set search_path = '';
alter function public.check_void_approver() set search_path = '';
