-- Run this once if schema.sql failed with "policy ... already exists".
-- It safely removes existing policies so schema.sql can be re-run cleanly.

drop policy if exists "profiles read own or staff" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "categories read" on public.categories;
drop policy if exists "menu read" on public.menu_items;
drop policy if exists "staff categories all" on public.categories;
drop policy if exists "staff menu all" on public.menu_items;
drop policy if exists "customers read own orders" on public.orders;
drop policy if exists "customers create own orders" on public.orders;
drop policy if exists "staff update orders" on public.orders;
drop policy if exists "read order items" on public.order_items;
drop policy if exists "create order items" on public.order_items;
drop policy if exists "read payments" on public.payments;
drop policy if exists "create payments" on public.payments;
drop policy if exists "read status history" on public.order_status_history;
drop policy if exists "staff add status history" on public.order_status_history;
drop policy if exists "staff read refunds" on public.refunds;
drop policy if exists "staff create refunds" on public.refunds;
