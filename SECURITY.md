# Security Policy

## Reporting a vulnerability

If you have found a security issue in Career Studio, please **do not**
open a public GitHub issue. Email **security@careerstudio.lk** with:

- A description of the issue and its impact
- Steps to reproduce (a curl command, a minimal repro repo, or a short
  video are all welcome)
- Your name / handle for credit, if you'd like to be acknowledged

We will:

1. Acknowledge receipt within 2 business days
2. Provide a substantive update within 7 days
3. Coordinate a fix and disclosure timeline with you

We do not currently run a paid bug bounty. We do credit reporters in the
release notes for the patch unless you ask us not to.

## In scope

- The production Career Studio application and its API (`careerstudio.lk`
  and any subdomain we operate)
- Source code in this repository

## Out of scope

- Third-party services we use (Vercel, Supabase / Neon, Stripe, Resend,
  Google Cloud, Inngest). Report those to the vendor directly.
- Findings that require physical access to a user's device, social
  engineering of our staff, or a compromised user account that the user
  willingly handed over
- Reports from automated scanners with no demonstrated impact
- Rate-limit bypasses where the limiter is in-process by design (see
  `src/lib/rate-limit.ts` — multi-instance behavior is documented and
  not a vulnerability)

## Safe harbor

If you make a good-faith effort to comply with this policy during your
research, we will not pursue or support legal action against you for
your research. Please:

- Stop and contact us immediately if you encounter user data
- Do not access more data than necessary to demonstrate the issue
- Do not run automated scans against production with destructive payloads
