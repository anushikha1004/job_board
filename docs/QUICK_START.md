# Quick Start

## Requirements
- Node.js 20+
- npm 9+

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Common Commands

```bash
npm run lint
npm run build -- --webpack
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values.

```bash
cp .env.example .env.local
```

## Troubleshooting

- Port already in use:
  ```bash
  npm run dev -- -p 3001
  ```
- Clear cache:
  ```bash
  rm -rf .next node_modules package-lock.json
  npm install
  ```
