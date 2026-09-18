-- Gee Haven Admin setup
-- Replace YOUR-ADMIN-EMAIL with the email of the Supabase Auth account you already created.
-- This does NOT change or expose the password.

alter table public.profiles add column if not exists username text unique;

update public.profiles p
set username='admin', role='admin'
from auth.users u
where p.id=u.id
  and lower(u.email)=lower('YOUR-ADMIN-EMAIL');

-- Verify
select p.username,p.full_name,p.role,u.email
from public.profiles p
join auth.users u on u.id=p.id
where p.username='admin';
