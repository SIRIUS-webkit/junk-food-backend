# Deploy with Render + Supabase

> **Use the 3-environment guide:** [ENVIRONMENTS.md](./ENVIRONMENTS.md)  
> Local + staging + production, separate databases, tag-based prod deploys.

This file is kept for Supabase connection details. See **ENVIRONMENTS.md** for the full workflow.

## Supabase connection strings (per project)

For **each** Supabase project (staging and production):

| Render variable | Supabase source | Port |
|-----------------|-----------------|------|
| `DATABASE_URL` | Connection pooling → **Transaction** | 6543 + `?pgbouncer=true` |
| `DIRECT_URL` | **Direct connection** | 5432 |

## Render services

- **junkshop-api-staging** — `APP_ENV=staging`, auto-deploy on `main`
- **junkshop-api-prod** — `APP_ENV=production`, deploy on git tag via GitHub Actions

See `render.yaml` and `.env.staging.example` / `.env.production.example`.
