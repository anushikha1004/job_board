# Production Checklist (TechHire)

Use this as a final pre-launch checklist for Vercel or any host.

## Environment
- [ ] `NEXT_PUBLIC_FIREBASE_*` values set in host environment.
- [ ] `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_RESUME_BUCKET` set.
- [ ] `NEXT_PUBLIC_SITE_URL` set to the production domain (HTTPS).
- [ ] Optional: `RESUME_SCAN_WEBHOOK_URL` set if you use file scanning.
- [ ] `.env.local` is NOT committed to Git.

## Firebase
- [ ] Firestore rules deployed and verified with real candidate + recruiter accounts.
- [ ] Storage rules deployed if resume upload is enabled.
- [ ] Firebase Auth email templates updated (logo + name).
- [ ] Allowed domains configured in Firebase Auth (for production domain).

## Admin + Roles
- [ ] At least one admin user: `user_profiles/{uid}.role = "admin"`.
- [ ] Admin can access `/admin` and see audit logs + funnel metrics.
- [ ] Candidate and recruiter flows redirect correctly.

## Resume Upload
- [ ] Storage bucket created and set as `SUPABASE_RESUME_BUCKET`.
- [ ] Upload, replace, delete, and history views working.
- [ ] Signed URL renewal works (resume still opens after 1+ hour).

## Core UX
- [ ] Candidate profile is complete and validates required fields.
- [ ] Job apply works and shows Applied state properly.
- [ ] Notifications badge updates correctly after read.
- [ ] Search + filters work and load performance is acceptable.

## Security
- [ ] `serviceAccountKey.json` removed from repo and git history.
- [ ] Secrets stored only in host environment.
- [ ] CORS settings are locked down if any custom APIs are used.

## SEO + Trust
- [ ] `/about`, `/privacy`, `/terms`, `/contact` accessible.
- [ ] OpenGraph + Twitter meta tags show correct preview.
- [ ] Structured data for job cards added (if applicable).

## Monitoring
- [ ] Sentry (or preferred tool) configured and tested.
- [ ] `/health` endpoint passes in production.

## Final Checks
- [ ] `npm run lint`
- [ ] `npm run build -- --webpack`
- [ ] Smoke test key flows in production (login, post job, apply).
