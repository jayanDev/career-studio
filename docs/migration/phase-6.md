# Phase 6 - Content + Admin

## Added

- Blog post comments with authenticated submission, approved-comment display, likes, and staff moderation.
- Dynamic resources library with Prisma resources, premium gating, saved resources, download tracking, and fallback public cards.
- Ebook reader pages with authenticated highlights and notes backed by `BookAnnotation`.
- Floating authenticated feedback widget in the app shell.
- Staff-only `/[locale]/admin` moderation page for pending comments, open feedback, and forum flags.

## Models Touched

- Used existing Prisma models: `BlogPost`, `BlogComment`, `BlogLike`, `Resource`, `ResourceDownload`, `SavedResource`, `BookAnnotation`, `Feedback`, and `ForumFlag`.
- No Prisma schema migration was added.

## Deferred

- The Django blog comment schema has richer spam/moderation fields; the current Prisma model only supports `isApproved`.
- Ebook rendering uses lightweight reader content instead of copying static flipbook assets into Next public storage.
- Resource view analytics and uploaded screenshot storage for feedback remain deferred until storage conventions are final.
