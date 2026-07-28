# Bicycle Inventory ERP

## Current app behavior

This React application is currently built as a browser-first inventory ERP with:
- localStorage persistence for offline/local usage
- Supabase Auth support for email/password login and custom application user IDs stored in user metadata
- Dedicated Supabase tables for profiles, products, orders, dealers, payments, officers, targets, notifications, stock entries, stock transfers, retail transactions and customization

This version is now prepared to run on Vercel with a shared Supabase data store. All users can view the same inventory items across browsers, while admin and member metadata remain available for role-based UI options.

## Recommended production architecture

1. **Supabase Authentication**
   - Use Supabase Auth for login instead of browser-only `api.login`.
   - Store users in Supabase auth and/or a `profiles` table.
   - Use role-based access for `admin` and `member`.

2. **Dedicated tables for each entity**
   - `users` / `profiles`
   - `products`
   - `orders`
   - `dealers`
   - `payments`
   - `officers`
   - `targets`
   - `notifications`
   - `product_stock_entries`
   - `product_stock_transfers`
   - `retail_transactions`
   - `customization`

3. **Row-level security (RLS)**
   - Add a `created_by` or `team_id` column on records.
   - Use RLS policies so each browser session only reads/writes the correct user/team data.
   - This keeps simultaneous users independent.

4. **Server-side backup automation**
   - Daily backup should not be done from the browser.
   - Use a server-side scheduled job or Supabase Edge Function to export data and upload to Google Drive.
   - Keep a retention policy that deletes old backups automatically.

5. **Deployment**
   - Host the frontend on Vercel.
   - Set the following Vercel environment variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - Use Vercel static deployment for the Vite app.

6. **Mobile app strategy**
   - Build a PWA from this React app for mobile-friendly web use.
   - Or share the Supabase API layer with a React Native / Expo app for a native mobile experience.

## Setup for local development

1. Create a Supabase project.
2. Run `supabase-schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Run locally:
   - `npm install`
   - `npm run dev`

## Deployment to Vercel

1. Add the repository to Vercel.
2. Configure environment variables for the Vercel project. Use your Vercel deployment URL in Supabase auth redirect settings and `SITE_URL` if applicable.
3. Set build command: `npm run build`.
4. Set output directory: `dist`.

## Notes

- The current implementation keeps local browser state for fast UI responsiveness and also syncs data into dedicated Supabase tables for multi-browser sharing.
- For a robust multi-user online system, Supabase tables are now defined in `supabase-schema.sql` and protected by RLS policies for authenticated access.
- Daily Google Drive backup should be implemented as a backend process, not a browser-side snapshot.
