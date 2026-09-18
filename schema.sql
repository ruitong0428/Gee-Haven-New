-- ============================================================
-- Gee Haven Supabase Database
-- Run this whole file in Supabase SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  role text not null default 'customer' check(role in ('customer','staff','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories(
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  icon text,
  display_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.menu_items(
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  ingredients text,
  price numeric(10,2) not null check(price>=0),
  image_url text,
  is_available boolean default true,
  is_featured boolean default false,
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.orders(
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text,
  table_info text,
  subtotal numeric(10,2) default 0,
  service_charge numeric(10,2) default 0,
  sst numeric(10,2) default 0,
  total numeric(10,2) default 0,
  status text default 'New' check(status in ('New','Accepted','Preparing','Ready','Completed','Cancelled','Refunded')),
  payment_status text default 'Pending' check(payment_status in ('Pending','Paid','Refunded','Failed')),
  payment_method text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.order_items(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name text not null,
  unit_price numeric(10,2) not null,
  quantity int not null check(quantity>0),
  customization jsonb default '{}'::jsonb,
  special_request text,
  item_total numeric(10,2) not null
);

create table if not exists public.payments(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method text,
  amount numeric(10,2) not null,
  status text default 'Pending',
  transaction_reference text,
  created_at timestamptz default now()
);

create table if not exists public.order_status_history(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.refunds(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  refund_type text default 'Full' check(refund_type in ('Full','Partial')),
  amount numeric(10,2) not null check(amount>=0),
  reason text,
  status text default 'Processed',
  created_at timestamptz default now()
);

-- Profile automatically created after registration
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.profiles(id,full_name)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users for each row
execute procedure public.handle_new_user();

-- Admin helper
-- Username login helper. It only returns the email belonging to an exact username.
create or replace function public.get_login_email(p_username text)
returns text language sql stable security definer set search_path=public
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id=p.id
  where lower(p.username)=lower(trim(p_username))
  limit 1;
$$;
grant execute on function public.get_login_email(text) to anon, authenticated;

create or replace function public.is_staff_or_admin()
returns boolean language sql stable security definer set search_path=public
as $$
select exists(select 1 from public.profiles where id=auth.uid() and role in ('staff','admin'));
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_status_history enable row level security;
alter table public.refunds enable row level security;

-- Profiles
drop policy if exists "profiles read own or staff" on public.profiles;
create policy "profiles read own or staff" on public.profiles for select
using(id=auth.uid() or public.is_staff_or_admin());
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update
using(id=auth.uid()) with check(id=auth.uid());

-- Menu public read
drop policy if exists "categories read" on public.categories;
create policy "categories read" on public.categories for select
using(is_active=true or public.is_staff_or_admin());

drop policy if exists "menu read" on public.menu_items;
create policy "menu read" on public.menu_items for select
using(is_available=true or public.is_staff_or_admin());

drop policy if exists "staff categories all" on public.categories;
create policy "staff categories all" on public.categories for all
using(public.is_staff_or_admin()) with check(public.is_staff_or_admin());

drop policy if exists "staff menu all" on public.menu_items;
create policy "staff menu all" on public.menu_items for all
using(public.is_staff_or_admin()) with check(public.is_staff_or_admin());

-- Orders
drop policy if exists "customers read own orders" on public.orders;
create policy "customers read own orders" on public.orders for select
using(user_id=auth.uid() or public.is_staff_or_admin());

drop policy if exists "customers create own orders" on public.orders;
create policy "customers create own orders" on public.orders for insert
with check(user_id=auth.uid());

drop policy if exists "staff update orders" on public.orders;
create policy "staff update orders" on public.orders for update
using(public.is_staff_or_admin()) with check(public.is_staff_or_admin());

-- Order items
drop policy if exists "read order items" on public.order_items;
create policy "read order items" on public.order_items for select
using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_staff_or_admin())));

drop policy if exists "create order items" on public.order_items;
create policy "create order items" on public.order_items for insert
with check(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));

-- Payments
drop policy if exists "read payments" on public.payments;
create policy "read payments" on public.payments for select
using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_staff_or_admin())));

drop policy if exists "create payments" on public.payments;
create policy "create payments" on public.payments for insert
with check(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));

-- Status history
drop policy if exists "read status history" on public.order_status_history;
create policy "read status history" on public.order_status_history for select
using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_staff_or_admin())));

drop policy if exists "staff add status history" on public.order_status_history;
create policy "staff add status history" on public.order_status_history for insert
with check(public.is_staff_or_admin());

-- Refunds
drop policy if exists "staff read refunds" on public.refunds;
create policy "staff read refunds" on public.refunds for select using(public.is_staff_or_admin());
drop policy if exists "staff create refunds" on public.refunds;
create policy "staff create refunds" on public.refunds for insert with check(public.is_staff_or_admin());

-- Seed categories
insert into public.categories(name,description,icon,display_order) values
('Food','Main dishes','🍚',1),
('Drinks','Refreshing drinks','🥤',2),
('Soup','Warm soups','🍲',3),
('Dim Sum','Chinese dim sum','🥟',4),
('Dessert','Sweet treats','🍰',5)
on conflict(name) do nothing;

-- Seed menu
insert into public.menu_items(category_id,name,description,price,display_order)
select id,'Hainan Chicken Rice','Tender chicken with fragrant rice and homemade sauce.',16.90,1 from categories where name='Food'
and not exists(select 1 from menu_items where name='Hainan Chicken Rice');

insert into public.menu_items(category_id,name,description,price,display_order)
select id,'Nasi Lemak Special','Coconut rice with sambal and classic sides.',14.90,2 from categories where name='Food'
and not exists(select 1 from menu_items where name='Nasi Lemak Special');

insert into public.menu_items(category_id,name,description,price,display_order)
select id,'Sweet & Sour Chicken','Crispy chicken with sweet and sour sauce.',18.90,3 from categories where name='Food'
and not exists(select 1 from menu_items where name='Sweet & Sour Chicken');

insert into public.menu_items(category_id,name,description,price,display_order)
select id,'Iced Lemon Tea','Refreshing tea with fresh lemon.',6.00,4 from categories where name='Drinks'
and not exists(select 1 from menu_items where name='Iced Lemon Tea');

insert into public.menu_items(category_id,name,description,price,display_order)
select id,'Siu Mai (4 pcs)','Classic steamed dim sum.',6.90,5 from categories where name='Dim Sum'
and not exists(select 1 from menu_items where name='Siu Mai (4 pcs)');

insert into public.menu_items(category_id,name,description,price,display_order)
select id,'Har Kow (4 pcs)','Crystal prawn dumplings.',6.90,6 from categories where name='Dim Sum'
and not exists(select 1 from menu_items where name='Har Kow (4 pcs)');

-- ============================================================
-- AFTER registering your admin account, run in Supabase SQL Editor:
-- update public.profiles p set username='tong', role='admin'
-- from auth.users u where p.id=u.id and lower(u.email)=lower('YOUR-ADMIN-EMAIL');
-- IMPORTANT: do not store the password in this SQL file or frontend code.
-- ============================================================

-- ============================================================
-- ORDER STATUS MIGRATION (run this if your existing orders table
-- was created with Accepted instead of Confirmed)
-- ============================================================
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
check(status in ('New','Confirmed','Preparing','Ready','Completed','Cancelled','Refunded'));

-- Keep status history readable by the customer and staff.
-- The website writes one row whenever checkout/status changes happen.
