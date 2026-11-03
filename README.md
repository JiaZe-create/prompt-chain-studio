# Prompt Chain Studio

A separate Next.js application for Google-authenticated superadmins. It shares the public and admin apps' Supabase database.

## Features
- Create, update, and delete prompt chains and steps.
- Transactional up/down reordering with complete-set validation and a database lock.
- Sequential Gemini text generation from text or an uploaded image (PNG/JPEG/WebP, up to 2 MB).
- Original input (`{{input}}`) and preceding output (`{{previous}}`) prompt placeholders.
- Saved final text, intermediate outputs, error details, and a snapshot of the steps used in each run.
- Light, dark, and operating-system themes.
- Google login, fresh server-side `profiles.is_superadmin` checks, and database RLS.

## Environment
Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY` (a publishable key is supported), and server-only `GOOGLE_GENERATIVE_AI_API_KEY` in Vercel. Never commit private keys.

Add the production and commit deployment `/auth/callback` URLs to the Supabase Auth redirect allowlist. Vercel deployment protection is disabled; app-level Google and superadmin protection remains enabled.

## Database
`supabase/prompt-chain-studio.sql` extends the existing `prompt_chains` and `prompt_chain_steps` tables and adds `prompt_chain_runs` and transaction functions. It assumes the existing `private.is_superadmin()` helper and admin assignment schema. Apply once with a migration, not at app startup.

Existing chains referenced by `prompt_chain_mix` cannot be deleted until the reference is removed in the admin app. New chains can be deleted with their steps and runs.

## Development
`npm ci`, `npm run dev`, `npm test`, and `npm run build`.

## Generation
Every step sends its rendered prompt to its configured Gemini model. An uploaded image is included in the first step only. Outputs are persisted after each step, and completed text appears in Generated media. There are no simulated generation results. A missing key, provider failure, quota limit, or inaccessible model produces a visible error. Model names can be edited per step.

A run is limited to 20 steps and approximately four minutes; only one run per user can be active. Abandoned runs expire after six minutes. Uploaded image bytes are sent to the model but not retained in the database; run records preserve the text input and an image-present flag.
