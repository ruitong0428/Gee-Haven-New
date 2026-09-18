# Gee Haven — Complete HTML/CSS/JavaScript Restaurant App

## Includes
Customer:
- Home
- About / Owner
- Menu with categories and search
- Cart
- Checkout
- Login / Register with Supabase Auth
- Order confirmation
- Order tracking
- My Orders

Admin:
- Dashboard
- Active orders
- Order status updates
- Order history
- Menu availability
- Refund records

## Supabase setup
1. Create a Supabase project.
2. Open `supabase/schema.sql` in Supabase SQL Editor and run it.
3. Open `js/supabase.js`.
4. Replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY`.
5. Use VS Code Live Server to open `index.html`.
6. Register an account.
7. Find the account ID in Supabase Authentication > Users.
8. Run:
   update public.profiles set role='admin' where id='YOUR-USER-UUID';

## Payment note
This project records payment method/status in Supabase, but it does not connect to a real
bank/card gateway. A real payment provider should be integrated before production.
