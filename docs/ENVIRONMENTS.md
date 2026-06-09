# Environments: Local, Staging, Production

Three isolated environments, each with its **own database** (Supabase project).

| Environment | API | Database | How it deploys |
|-------------|-----|----------|----------------|
| **local** | `npm run dev` / Docker | Local Postgres (docker-compose) | Your machine |
| **staging** | `junkshop-api-staging.onrender.com` | Supabase **staging** project | Push to `main` (auto) |
| **production** | `junkshop-api-prod.onrender.com` | Supabase **production** project | Git tag `v*` on `main` |

---

## 1. Supabase — two projects

Create **two separate** Supabase projects:

1. **junkshop-staging** — for staging API + testing
2. **junkshop-production** — for real users

For each project, copy from **Settings → Database**:

- **Pooler URL** (port 6543) → Render `DATABASE_URL` + `?pgbouncer=true`
- **Direct URL** (port 5432) → Render `DIRECT_URL`

See `.env.staging.example` and `.env.production.example` for the full variable list.

---

## 2. Render — two web services

Use `render.yaml` (Blueprint) or create manually:

| Service | Name | Auto-deploy | `APP_ENV` | `SEED_DEMO_ENTITY` |
|---------|------|-------------|-----------|---------------------|
| Staging | `junkshop-api-staging` | **Yes** (branch `main`) | `staging` | `true` |
| Production | `junkshop-api-prod` | **No** | `production` | `false` |

### Staging env vars (Render dashboard)

Copy from `.env.staging.example` — use **staging** Supabase URLs and staging admin credentials.

### Production env vars (Render dashboard)

Copy from `.env.production.example` — use **production** Supabase URLs and real admin credentials.

---

## 3. Git deploy workflow

### Day-to-day → **staging**

```bash
git add .
git commit -m "feat: your change"
git push origin main
```

Render **staging** service auto-deploys on every push to `main`.

Verify:

```bash
curl https://junkshop-api-staging.onrender.com/api/v1/health
# {"success":true,"status":"ok","env":"staging",...}
```

### Release → **production**

When staging looks good, tag the commit on `main`:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This triggers **GitHub Actions** (`.github/workflows/deploy-production.yml`) which calls the Render **production deploy hook**.

### One-time GitHub setup

1. Render → **junkshop-api-prod** → **Settings** → **Deploy Hook** → copy URL
2. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
3. New secret: `RENDER_PROD_DEPLOY_HOOK` = deploy hook URL

Verify production:

```bash
curl https://junkshop-api-prod.onrender.com/api/v1/health
# {"success":true,"status":"ok","env":"production",...}
```

---

## 4. Local development

### Option A — Docker (recommended)

```bash
cp .env.local.example .env.local
# Edit DATABASE_URL if needed (default port 5433 for docker-compose)
docker compose up --build
```

### Option B — npm dev (Postgres running)

```bash
cp .env.local.example .env.local
npm install
npm run prisma:migrate
npm run seed
npm run dev
```

Local loads `.env` then `.env.local` (via `APP_ENV=local`).

Health check:

```bash
curl http://localhost:4000/api/v1/health
# {"env":"local",...}
```

---

## 5. Mobile app (scrap-pos-app)

Use a different `.env` file per target:

| File | Command | API |
|------|---------|-----|
| `.env.local` | `npm start` | `http://YOUR_LAN_IP:4000/api/v1` |
| `.env.staging` | `npm run start:staging` | `https://junkshop-api-staging.onrender.com/api/v1` |
| `.env.production` | `npm run start:production` | `https://junkshop-api-prod.onrender.com/api/v1` |

Setup:

```bash
cd scrap-pos-app
cp .env.local.example .env.local
cp .env.staging.example .env.staging
cp .env.production.example .env.production
# Edit URLs to match your Render service names
```

---

## 6. Environment files reference

| Backend file | Purpose |
|--------------|---------|
| `.env.example` | Minimal pointer |
| `.env.local.example` | Local dev template |
| `.env.staging.example` | Staging Render + Supabase template |
| `.env.production.example` | Production Render + Supabase template |

Real secrets live in `.env.local` / Render dashboard — **never commit them**.

---

## 7. Troubleshooting

| Issue | Check |
|-------|--------|
| Staging didn't deploy | Render staging service → Events; confirm auto-deploy on `main` |
| Prod didn't deploy | GitHub Actions log; `RENDER_PROD_DEPLOY_HOOK` secret set? |
| Wrong database | `curl .../health` → check `env` field; verify `DATABASE_URL` on that Render service |
| **`entities` table missing (P2021)** | Migrations never ran — see fix below |
| Local Prisma error | Add `DIRECT_URL` same as `DATABASE_URL` for local Postgres |
| App hits wrong API | Check which `npm start:*` script you used; login screen shows API URL |

### Fix: `The table public.entities does not exist` (P2021)

Migrations were not applied to Supabase.

**Option A — from your laptop (fastest):**

```bash
cd junk-shop-backend
# Set in shell or .env.staging:
# DATABASE_URL=<Supabase pooler URL ?pgbouncer=true>
# DIRECT_URL=<Supabase direct URL port 5432>
npm run build
npx prisma migrate deploy
npm run seed
```

Check Supabase **Table Editor** for `entities`, `super_admins`, etc.

**Option B — Render redeploy (after latest code):**

The API now runs **migrate + seed automatically on boot** when `APP_ENV` is `staging` or `production`.

1. **Required on Render** (both must be set):

   | Variable | Supabase source |
   |----------|-----------------|
   | `DATABASE_URL` | Pooler, port **6543**, append `?pgbouncer=true` |
   | `DIRECT_URL` | Direct, port **5432** |

   If `DIRECT_URL` is missing, the service will **fail to start** with a clear error.

2. **Start Command:** `npm run render:start` or `node dist/index.js` (both work now).

3. **Manual Deploy** → logs must show **before** "listening":
   ```
   📦 Applying database migrations...
   🌱 Running database seed...
   ✅ Database bootstrap complete
   🟢 JunkShop API [production] listening...
   ```

4. If migrate fails in logs, fix `DIRECT_URL` / password and redeploy.

---

## Quick reference

```bash
# Staging release cycle
git push origin main                    # → staging

# Production release (after staging OK)
git tag v1.0.1 && git push origin v1.0.1   # → production
```

Tag naming: use semver tags `v1.0.0`, `v1.0.1`, etc. (workflow matches `v*`).
