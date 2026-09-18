-- Restores all Row Level Security policies for Gee Haven.
-- Safe to run any number of times.

-- Make sure the helper functions these policies rely on exist.
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

