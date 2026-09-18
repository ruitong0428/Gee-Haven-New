# Gee Haven Admin setup

## 1. Run the database SQL
In Supabase -> SQL Editor, run the updated `supabase/schema.sql`.
If your tables already exist, the `username` column may need to be added with:

```sql
alter table public.profiles add column if not exists username text unique;
```

Also run the function/policies from the updated schema, or run the complete schema in a fresh project.

## 2. Quick Admin login
For a simple demo/test, the login page accepts:

- Account name: `admin`
- Password: `password123`

This opens `admin/index.html` directly.

For a real Supabase Admin account, use the SQL file `supabase/MAKE_ADMIN_TONG.sql` and set the user's profile role to `admin`.

Do not put the password into HTML/JS.

## 3. Admin redirect
After successful login, Gee Haven reads `profiles.role`:
- admin/staff -> `admin/index.html`
- customer -> customer home

## 4. Admin functions
- Dashboard: order count, active orders, sales, refunds
- Active Orders: customer name, order number, items, total, payment, table, status changes
- History: customer, items, total, status, payment status and date
- Menu: edit item name and price, hide/show item; customer menu reads the same Supabase table
- Refunds: records full refunds in Supabase and changes the order to Refunded

## 5. Customer synchronization
Customer order tracking polls Supabase every 5 seconds, so Admin status changes appear automatically.
The customer menu refreshes every 10 seconds, so menu availability/name/price changes are reflected automatically.

### Refund limitation
The current project records a refund in Supabase. It does not actually send money to a bank/card. A real payment provider API is required for real-money refunds.
