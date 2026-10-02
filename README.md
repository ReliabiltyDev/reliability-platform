# Reliability Platform

A React, Vite, TypeScript, and Supabase application for reliability engineering workflows.

## Local setup

Prerequisites: Node.js 24, Docker, and the Supabase CLI.

1. Install JavaScript dependencies:

   ```sh
   npm install
   ```

2. Start the local Supabase stack and apply the tracked migrations and development seed:

   ```sh
   supabase start
   supabase db reset
   ```

   The CLI prints the local API URL and publishable key. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to those local values.

3. Start the app:

   ```sh
   npm run dev
   ```

The local seed creates a demo site, area, production line, and asset. It contains no user accounts; create a local account through the app. Local email confirmation is disabled in `supabase/config.toml` for development.

## Build

```sh
npm run build
```

GitHub Actions builds on Node.js 24. The Pages workflow deploys the `main` branch.

## Database changes

Schema changes belong in timestamped files under `supabase/migrations`. The migration history in this repository mirrors the linked development database, followed by the latest shared-workspace permissions migration. Keep development seed data in `supabase/seed.sql`; never include user records, credentials, or production data there.

Use `supabase db reset` only against the local development stack. Review remote migration changes before applying them to a shared or production project.

