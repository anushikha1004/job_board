# Smoke Tests

Use these quick checks before and after deploy.

## 1) CI smoke check (no running server needed)

```bash
npm run smoke:ci
```

This runs:
- lint
- production build (`next build --webpack`)

## 2) HTTP smoke check (requires running app)

Start app first:

```bash
npm run dev
```

Then in another terminal:

```bash
npm run smoke:http
```

Checks key public routes and fails if any return non-2xx/3xx status.

## 3) Check deployed environment

```bash
SMOKE_BASE_URL=https://your-app.vercel.app npm run smoke:http
```

This verifies your live deployment responds correctly on critical pages.
