insert into public.user_roles (user_id, role)
values ('80956f49-1e5e-4b0e-938e-70a1f9b67542', 'super_admin')
on conflict (user_id, role) do nothing;