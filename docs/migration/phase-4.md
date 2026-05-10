# Phase 4 - Job Hunting

- Added job tracker services/actions plus the `/job-tracker` dashboard with create form, Kanban drag-drop, list view, and Recharts analytics.
- Added interview question-bank filters, practice history, structured AI feedback action, and `/api/ai/interview-feedback` streaming endpoint.
- Added salary calculator action and `/salary` page with LKR-first ranges, privacy threshold handling, recent calculations, and Sri Lankan cost-of-living comparison.
- Added Career GPS resource aggregation from courses, tools, resources, and interview questions.
- Added Career GPS roadmap generation, session/questionnaire/goal/plan persistence, milestones, weekly tasks, and plan display on `/career-gps`.
- Added LinkedIn audit form/history, result detail route, score breakdowns, missing keywords, checklist, and section rewrite action.
- Added shared schemas in `src/lib/career-gps.ts`, `src/lib/linkedin-audit.ts`, and tracker metadata in `src/lib/job-tracker.ts`.
- Added Phase 4 message namespaces to `messages/en.json`, `messages/si.json`, and `messages/ta.json` with English fallback text.
- Models touched: no Prisma schema changes; reused Phase 0 Phase 4 models.
- Verified: `npm run lint`, `npx tsc --noEmit`, `npx prisma validate`, `npm run build`, and `git diff --check`.
- Smoke checked unauthenticated `/en/job-tracker`, `/en/interview`, `/en/salary`, `/en/career-gps`, `/en/linkedin`, and LinkedIn audit detail redirects.
- Smoke checked `/api/ai/interview-feedback` returns `401` when unauthenticated.
- Deferred: authenticated browser smoke with a real Supabase/Postgres user session.
- Deferred: robust PDF/DOCX profile extraction for LinkedIn and CV upload extraction for Career GPS.
- Deferred: full job-application detail/edit screens, reminder completion UI, Career GPS task toggles, and salary submission moderation flows.
