# Deployment Guide

PaaS-first deployment for **spleenet-platform-core**. The platform handles TLS and routing — no nginx required on Render, Railway, or Fly.

## Architecture

```
Clients / Paystack  →  PaaS edge (HTTPS)  →  Docker container (:4000)
                                              ├── Express + Apollo GraphQL
                                              └── BullMQ notification worker
                         ↓                              ↓
                    Neon Postgres                  Redis (managed)
```

## Prerequisites

- Neon Postgres database (`DATABASE_URL`)
- Managed Redis (Render Redis add-on, Upstash, or Railway Redis)
- Paystack live key + webhook secret (production payments)
- Resend API key (email delivery)
- FCM credentials (push notifications, optional)

## Local development with Docker

### Production-like stack

```bash
cp .env.example .env
# Set DATABASE_URL to your Neon connection string in .env

docker compose up --build
```

- API: http://localhost:4000/graphql
- Health: http://localhost:4000/health
- Readiness: http://localhost:4000/health/ready
- Redis runs in Compose; `REDIS_URL` is overridden to `redis://redis:6379`

### Hot-reload dev stack

```bash
docker compose -f docker-compose.dev.yml up
```

Mounts source code and runs `npm run dev` (tsx watch).

## Database migrations

The production Docker image does **not** include `drizzle-kit` (dev dependency).

Run schema sync **before** deploying:

```bash
npm run db:push
```

Long-term: adopt versioned SQL migrations (`db:generate` + `db:migrate`).

## Deploy to Render

1. Push this repo to GitHub.
2. Render Dashboard → **New** → **Blueprint** → select repo → apply `render.yaml`.
3. Set secret env vars in the dashboard:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Neon connection string |
| `FRONTEND_URL` | Yes | e.g. `https://app.spleenet.com` |
| `RESEND_API_KEY` | Recommended | Email delivery |
| `PAYSTACK_SECRET_KEY` | Production | Live key |
| `PAYSTACK_WEBHOOK_SECRET` | Production | From Paystack dashboard |
| `FCM_PROJECT_ID` | Optional | Push notifications |
| `FCM_CLIENT_EMAIL` | Optional | Push notifications |
| `FCM_PRIVATE_KEY` | Optional | Push notifications (escape newlines) |
| `COOKIE_DOMAIN` | Optional | Set if cookies need explicit domain |
| `CLOUDINARY_*` | Optional | Not used in code yet |

4. Run `npm run db:push` against the production Neon DB.
5. Seed admin (one-off, from your machine):

```bash
npx tsx src/scripts/seed-admin.ts
```

6. Register Paystack webhook URL:

```
https://<your-render-service>.onrender.com/webhooks/paystack
```

Events: `charge.success`, `transfer.success`, `transfer.failed`

## Health checks

| Endpoint | Purpose | Use on PaaS |
|----------|---------|-------------|
| `GET /health` | Liveness — process is up | Optional |
| `GET /health/ready` | Readiness — Redis + DB reachable | **Primary health check** |

Render `render.yaml` uses `healthCheckPath: /health/ready`.

## Production env checklist

```env
NODE_ENV=production
COOKIE_SECURE=true
FRONTEND_URL=https://your-frontend-domain
DATABASE_URL=postgresql://...neon...
REDIS_URL=redis://...
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_WEBHOOK_SECRET=...
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on PRs and pushes to `main` / `develop`:

- `npm run lint`
- `npm run build`
- `npm run test:unit`

Integration tests are not run in CI (require Neon + Redis secrets). Run locally:

```bash
npm run test:integration
```

## Rollback

On Render: **Deploys** tab → select a previous successful deploy → **Rollback**.

## Railway / Fly.io

The same `Dockerfile` works on other PaaS platforms:

- Set env vars equivalent to the Render table above.
- Point health check to `/health/ready`.
- Link a managed Redis instance.
- Register the Paystack webhook to your public API URL.

## VPS / nginx (future)

If you move off PaaS to a single VPS, add a reverse proxy in front of the container. See `infra/nginx/nginx.conf.example` for a starting template.
