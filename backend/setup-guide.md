# Supabase Online Mode & Global Leaderboard Setup Guide

1. Create a project at https://supabase.com.
2. Open the **SQL Editor** in your Supabase Dashboard and execute the entire contents of `backend/supabase-schema.sql`.
3. In **Authentication -> Providers**, ensure **Email** authentication is enabled.
4. Open **Project Settings -> API Keys** (or **API**) and copy ONLY:
   - **Project URL** (`https://your-project-id.supabase.co`)
   - **Publishable Key** (`sb_publishable_...` or legacy **anon public** key)
   - Never use `service_role` or `sb_secret_...` keys in frontend code or `VITE_*` variables.
5. Enter them in **Cloudflare Pages -> Settings -> Environment Variables** (or local `.env` / AI Studio Secrets):
   ```env
   VITE_SUPABASE_URL="https://your-project-id.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-or-anon-key"
   ```
   > **Important:** `VITE_SUPABASE_URL` must be the base Project URL (`https://your-project-id.supabase.co`) **without** `/rest/v1` or trailing paths.
6. Trigger a fresh production build/redeploy (`npm run build`) or restart the dev server (`npm run dev`).
7. Offline gameplay and `localStorage` saves continue working at all times; when Supabase is configured, open **Business Management Computer -> Rankings & Cloud** to sign in and sync your score to the **GLOBAL ONLINE LEADERBOARD**.
