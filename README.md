# Career Studio Next

Sri Lanka-focused career platform on Next.js 15 App Router. Tools include
ATS Checker, CV / GCV Builder, LinkedIn Optimizer, Cover Letter, Career
GPS, and recruiter-side Talent Pool. AI features run on Google Gemini via
the Vercel AI SDK and degrade gracefully when no key is set.

## Stack

- Next.js 15 (App Router, React 19)
- Prisma 7 + Postgres
- NextAuth 5 (Google + Resend magic-link)
- Tailwind 4 + Radix / shadcn UI
- Google Gemini via `ai` SDK
- Stripe for billing
- Inngest for background jobs
- Vitest + Playwright (`@axe-core/playwright` for a11y)

## Getting started

```bash
# 1. Install
npm install

# 2. Copy env defaults; fill in DATABASE_URL at minimum.
cp .env.example .env

# 3. Push schema
npx prisma migrate deploy

# 4. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Every env var is documented in `.env.example`, including which features
fail open when a key is missing (AI banner instead of 500, billing 503,
etc.).

## Verifying your change

Before pushing, run the same checks CI does:

```bash
npm run verify   # typecheck + lint + i18n parity + vitest
npm run test:e2e # Playwright smoke + a11y (requires the dev server)
```

Individual commands:

| Command              | Purpose                                     |
| -------------------- | ------------------------------------------- |
| `npm run typecheck`  | `tsc --noEmit`                              |
| `npm run lint`       | ESLint                                      |
| `npm test`           | Vitest (unit tests for pure modules)        |
| `npm run check:i18n` | en / si / ta key parity                     |
| `npm run test:e2e`   | Playwright (public routes, health, a11y)    |
| `npm run analyze`    | Build with bundle analyzer (`ANALYZE=true`) |

## Documentation

- `docs/RUNBOOK.md` — operations runbook (deploy, health, incidents,
  rollback)
- `SECURITY.md` — vulnerability disclosure policy
- `AGENTS.md` / `CLAUDE.md` — conventions for AI assistants working in
  this repo

## Deploy

`main` deploys to Vercel automatically. See `docs/RUNBOOK.md` for the
first-time setup, env var checklist, and rollback procedure.
