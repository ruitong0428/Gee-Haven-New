-- ============================================================
-- Gee Haven — Order status auto-tracking
-- Run this ONCE in the Supabase SQL Editor (after schema.sql).
--
-- Why: order_status_history could only be written by staff/admin
-- (see the "staff add status history" policy in schema.sql). But
-- checkout.js tried to write the very first "New" entry as the
-- CUSTOMER, which the database silently rejected — so orders were
-- missing their "Order Placed" timestamp. This trigger removes the
-- need for any app code to write to order_status_history directly:
-- the database logs the "New" row the instant an order is created,
-- and logs every later status change (Confirmed/Preparing/
-- Completed/Cancelled/Refunded) the instant orders.status changes,
-- regardless of who made the change.
-- ============================================================

create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.order_status_history(order_id, status, changed_by)
    values (new.id, new.status, new.user_id);
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.order_status_history(order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_order_status on public.orders;

create trigger trg_log_order_status
after insert or update on public.orders
for each row execute function public.log_order_status_change();
