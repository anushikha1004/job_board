# Production Checklist

Use this list before deploying to Vercel or any production host.

## Environment
- [ ] `NEXT_PUBLIC_FIREBASE_*` set in host environment
- [ ] `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_RESUME_BUCKET` set
- [ ] `NEXT_PUBLIC_SITE_URL` set to the production domain (HTTPS)
- [ ] Optional: `RESUME_SCAN_WEBHOOK_URL` set if scan hook is enabled
- [ ] `.env.local` is not committed to Git

## Firebase
- [ ] Firestore rules deployed and verified with real candidate + recruiter accounts
- [ ] Storage rules deployed if resume upload is enabled
- [ ] Auth email templates updated (logo + app name)
- [ ] Authorized domains set to production domain

## Admin + Roles
- [ ] At least one admin user: `user_profiles/{uid}.role = "admin"`
- [ ] `/admin` loads and shows audit + funnel metrics
- [ ] Candidate and recruiter redirects are correct

## Resume Upload
- [ ] Storage bucket configured and matches `SUPABASE_RESUME_BUCKET`
- [ ] Upload, replace, delete, history working
- [ ] Signed URL renewal works after 1+ hour

## Core UX
- [ ] Candidate profile validation works
- [ ] Apply flow works and shows Applied state only when expected
- [ ] Notifications badge updates after read
- [ ] Search + filters behave correctly

## Security
- [ ] `serviceAccountKey.json` removed from repo and git history
- [ ] Secrets only stored in host environment
- [ ] CORS settings locked down if custom APIs used

## SEO + Trust
- [ ] `/about`, `/privacy`, `/terms`, `/contact` accessible
- [ ] OpenGraph + Twitter tags show correct preview
- [ ] Structured data for jobs (if used)

## Monitoring
- [ ] Sentry (or equivalent) configured and tested
- [ ] `/health` passes in production

## Final Checks
- [ ] `npm run lint`
- [ ] `npm run build -- --webpack`
- [ ] Smoke test login, post job, apply flow
