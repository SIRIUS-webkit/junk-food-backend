# JunkShop Backend

Multi-tenant backend for managing junk/scrap shops. Built with **Node.js + Express + TypeScript**, **Prisma ORM**, and **PostgreSQL**, fully dockerized.

A **Super Admin** manages Entities (companies). Each Entity has one or more **Shops** (branches) and one or more **Sub Users** (login accounts). The first sub user is the Entity's **main account** and implicitly holds every permission; additional sub users get fine-grained permissions.

---

## Tech stack

- Node.js 20, Express 4, TypeScript (strict)
- Prisma 5 + PostgreSQL 16
- JWT auth (access + refresh tokens), bcrypt password hashing
- Zod request validation, Helmet, CORS, Morgan logging
- Docker + docker-compose

---

## Quick start (Docker)

```bash
cp .env.example .env        # adjust secrets if you like
docker compose up --build
```

On boot the API container runs migrations, seeds the super admin, then starts.
API is at `http://localhost:4000`, Postgres at `localhost:5432`.

## Quick start (local, without Docker for the app)

```bash
cp .env.example .env
# point DATABASE_URL at a running Postgres (or `docker compose up db`)
npm install                 # runs `prisma generate` automatically
npm run prisma:migrate      # create tables
npm run seed                # create super admin (+ demo entity)
npm run dev                 # http://localhost:4000
```

> Note: `npm install` downloads the Prisma query engine. A network that
> blocks `binaries.prisma.sh` will prevent client generation — run the install
> on a normal network or inside Docker.

---

## Environment variables

See `.env.example`. Key ones:

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | token signing secrets |
| `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` | token lifetimes (default 15m / 7d) |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PHONE` / `SUPER_ADMIN_PASSWORD` | seeded super admin |

Default seeded super admin: `admin@junkshop.local` / `Admin@12345`.
The seed also creates a demo entity **Ko Bar Bu** (`code: KBB`) with **Shop 1**, **Shop 2**, and a main user `admin` / `Admin@12345`.

---

## Authentication

Two login flows, both returning `{ accessToken, refreshToken, user }`:

- **Super admin:** `POST /api/v1/auth/admin/login` `{ email, password }`
- **Entity user:** `POST /api/v1/auth/login` `{ entityCode, username, password }`

Send the access token as `Authorization: Bearer <token>` on every protected route.
Refresh with `POST /api/v1/auth/refresh` `{ refreshToken }`. Inspect the current user with `GET /api/v1/auth/me`.

**Scoping:** sub users are automatically locked to their own entity. The super
admin operates across entities and must pass `?entityId=` (query) or `entityId`
(body) on entity-scoped endpoints.

---

## API overview

Base path: `/api/v1`. All list endpoints support `?page=&pageSize=&search=`.

### Admin / Entities (super admin only)
| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/entities` | list / create entity (creates its main user via `mainUsername` + `mainPassword`) |
| GET/PUT/DELETE | `/entities/:id` | read / update / delete |

### Shops
`GET/POST /shops`, `GET/PUT/DELETE /shops/:id`

### Sub Users & Permissions
| Method | Path | Notes |
|--------|------|-------|
| GET | `/users/permissions` | list assignable permission keys |
| GET/POST | `/users` | list / create sub user (optional `permissions[]`) |
| GET/PUT/DELETE | `/users/:id` | read / update / delete (cannot delete main) |
| PUT | `/users/:id/password` | reset password |
| PUT | `/users/:id/permissions` | replace permission set |

### Products & Categories
`GET/POST /categories`, `GET/PUT/DELETE /categories/:id`
`GET/POST /products`, `GET/PUT/DELETE /products/:id` (filter `?categoryId=`)

### Stock
| Method | Path | Notes |
|--------|------|-------|
| GET | `/stock` | current balances (`?shopId=&productId=`) |
| GET | `/stock/transactions` | movement ledger (`?type=`) |
| POST | `/stock/damage` | `{ shopId, productId, quantity, note }` — decreases stock |
| POST | `/stock/loss` | same shape — decreases stock |
| POST | `/stock/balance` | `{ shopId, productId, quantity }` — set absolute on-hand |
| POST | `/stock/transfer` | `{ fromShopId, toShopId, productId, quantity }` |

### Customers / Suppliers
`GET/POST /customers`, `GET/PUT/DELETE /customers/:id`
`GET/POST /suppliers`, `GET/PUT/DELETE /suppliers/:id`

### Sales / Purchases
`GET/POST /sales`, `GET /sales/:id` — creating a sale decrements stock and logs a `SALE` movement.
`GET/POST /purchases`, `GET /purchases/:id` — creating a purchase increments stock and logs a `PURCHASE` movement.

### Reports (`?from=ISO&to=ISO&shopId=`)
- `GET /reports/sales/by-product`
- `GET /reports/sales/by-category`
- `GET /reports/sales/by-customer`
- `GET /reports/purchases/by-product`
- `GET /reports/purchases/by-category`
- `GET /reports/purchases/by-supplier`

### Settings
`GET/POST /settings/units`, `PUT/DELETE /settings/units/:id`
`GET/POST /settings/banks`, `PUT/DELETE /settings/banks/:id`

### Health
`GET /api/v1/health`

---

## Permissions

Sub users are granted permission keys (see `src/constants/permissions.ts`), e.g.
`product.manage`, `stock.transfer`, `report.view`. The entity **main account**
and the **super admin** bypass all permission checks.

---

## Project structure

```
prisma/
  schema.prisma        # data model
  seed.ts              # super admin + demo entity
src/
  app.ts               # express app
  index.ts             # server bootstrap
  config/env.ts        # env loading/validation
  lib/prisma.ts        # Prisma client singleton
  constants/           # permission keys
  middleware/          # auth, authorize, validate, error
  utils/               # jwt, password, ApiError, scope, pagination, response
  routes/index.ts      # route mounting
  modules/             # auth, entity, shop, user, category, product,
                       # customer, supplier, stock, sale, purchase,
                       # report, setting
```

## Useful scripts

```bash
npm run dev              # hot-reload dev server
npm run build            # compile to dist/
npm start                # run compiled build
npm run typecheck        # tsc --noEmit
npm run prisma:migrate   # create/apply a dev migration
npm run prisma:studio    # browse data
npm run seed             # seed super admin + demo data
```

## Data model notes

- **Stock** holds the live on-hand balance per `(shop, product)`; **StockTransaction** is an immutable ledger of every movement (damage, loss, adjustment, transfer, sale, purchase). Operations that change stock run in a DB transaction and refuse to go negative.
- Money/quantity fields use `Decimal(14,2)` for accuracy.
- Most records cascade-delete with their entity; sale/purchase line items restrict product deletion to preserve history.
