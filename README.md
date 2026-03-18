# TechHire

TechHire is a role-based job board built with Next.js (App Router), Firebase, and Tailwind.
It provides separate candidate and recruiter experiences, job posting, applications, notifications,
and resume handling.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run lint
npm run build -- --webpack
```

## Documentation

All documentation lives in `docs/`:

- `docs/INDEX.md` – documentation hub
- `docs/QUICK_START.md` – local dev setup
- `docs/FIREBASE_SETUP.md` – Firebase project + rules
- `docs/PRODUCTION_CHECKLIST.md` – pre-launch checklist
- `docs/DESIGN_SYSTEM.md` – UI tokens and design guidance

## Folder Layout

```
app/            Next.js routes and layouts
components/     UI components
lib/            data, auth, hooks, utilities
types/          shared types
public/         static assets
```

## License

MIT
