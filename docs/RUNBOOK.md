# Operations Runbook

Audience: whoever is on call. This document is the answer to "the site is
broken at 2am, what do I do?" — keep it short, keep it accurate.

If you change a deploy step, environment variable, or rollback procedure,
update this file in the same PR.

---

## 1. Stack at a glance

| Layer      | Service                                  |
| ---------- | ---------------------------------------- |
| Hosting    | Vercel (production + preview)            |
| Database   | Postgres (Supabase / Neon — see infra)   |
| Auth       | NextAuth 5 + Google + Resend magic links |
| AI         | Google Gemini via Vercel AI SDK          |
| Billing    | Stripe                                   |
| Background | Inngest                                  |
| Monitoring | `/api/health` (DB ping) + Sentry seam    |

Source of truth for env vars: `.env.example`.

---

## 2. First deploy on a fresh environment

1. Provision the Postgres database.
2. Push the schema:
   ```bash
   DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy
   ```
3. Set every variable from `.env.example` in the Vercel project
   (Production + Preview scopes). `AUTH_SECRET` must be generated with
   `openssl rand -base64 32`.
4. Configure the Stripe webhook to point at
   `https://<host>/api/webhooks/stripe`. Copy the signing secret into
   `STRIPE_WEBHOOK_SECRET`.
5. Trigger the first deploy from `main`.
6. Smoke check: `curl https://<host>/api/health` returns `{"status":"ok"}`.

---

## 3. Normal deploy

`main` auto-deploys via Vercel. No manual step.

Before merging to `main`:

- CI must be green (`npm test`, `npm run typecheck`, `npm run lint`,
  `npm run check:i18n`).
- Any new env var must be added to `.env.example` AND set in Vercel
  Production. Forgetting the latter will cause runtime 500s for whichever
  feature relies on it.
- DB schema changes must ship as a Prisma migration file, not a manual
  `db push`. Run `npx prisma migrate deploy` against production as part
  of the deploy.

---

## 4. Health checks

- `GET /api/health` → 200 `{status:"ok", latencyMs, commit}` when reachable
  and the DB ping succeeds.
- `GET /api/health` → 503 `{status:"degraded", component:"database"}`
  when the DB ping fails. Connection pool exhaustion or network partition
  is the usual cause; check Vercel logs for the underlying error.

The `commit` field reflects `VERCEL_GIT_COMMIT_SHA`. Use it to verify a
deploy actually rolled forward.

---

## 5. Common incidents

### 5a. AI features returning fallback responses

Symptoms: ATS scores look generic, Career GPS plans look templated, users
report "this is the same answer every time."

Cause: `GOOGLE_GENERATIVE_AI_API_KEY` is missing, revoked, or out of
quota.

Where to look: production logs filtered by `feature:ats:` or
`feature:career-gps:` — the observability seam logs every fallback hit.

Fix:

1. Confirm the key in Google AI Studio (quota? billing?).
2. Rotate via Vercel env var.
3. Redeploy or hit the "Redeploy" button without a new commit (env vars
   bind at boot).

User impact: degraded but functional. No data loss.

### 5b. Stripe webhook returning 503

Symptoms: subscriptions don't activate after checkout. Stripe Dashboard
shows webhook deliveries failing.

Cause: `STRIPE_WEBHOOK_SECRET` missing or wrong.

Fix:

1. Re-copy the signing secret from Stripe Dashboard → Webhooks → our
   endpoint → "Signing secret."
2. Update Vercel env var.
3. Redeploy.
4. Replay failed events from the Stripe Dashboard.

### 5c. Magic-link sign-in silently failing

Symptoms: users enter their email, nothing arrives.

Cause: Resend key missing, sending-domain DNS broken, or the from
address isn't on a verified domain.

Fix: check Resend Dashboard → Logs. If keys are valid, check DKIM / SPF
on the from-domain.

### 5d. Rate-limit denials spiking

Symptoms: legitimate users seeing 429s.

The limiter is in-memory and per-instance. If Vercel scales to many
serverless instances, each holds its own bucket — total throughput
multiplies by instance count. Real abuse mitigation requires Upstash
Redis (the `consume()` signature is the swap point in
`src/lib/rate-limit.ts`).

Short-term fix: bump the relevant preset in `RATE_LIMITS` and deploy.

---

## 6. Rollback

Vercel keeps every prior deploy. To roll back:

1. Vercel Dashboard → Deployments → find the last known-good deploy.
2. "..." menu → "Promote to Production."

**Caveat:** code rolls back instantly, the database does not. If the
broken deploy ran a destructive migration, rolling back the code without
also reversing the migration will leave the schema ahead of the
application. Prisma `migrate resolve --rolled-back` only marks state; it
does not undo SQL. Plan migrations to be additive-only for that reason.

---

## 7. Quarterly checklist

- Rotate `AUTH_SECRET` (sessions invalidate; users must re-sign in).
- Rotate `STRIPE_WEBHOOK_SECRET` and update Stripe Dashboard.
- Re-run `npm audit` and `npx prisma migrate status`.
- Confirm `/api/health` is wired in the uptime monitor and the on-call
  rotation gets paged.
- Review Sentry-equivalent dashboards for top errors; create issues for
  the long tail.
