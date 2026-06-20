-- Offline-first sync fields: sync_id (client UUID), deleted_at (soft delete),
-- and updatedAt for purchases/sales (backfilled from createdAt for existing rows).

-- Additive columns on existing-updatedAt tables
ALTER TABLE "shops"     ADD COLUMN "sync_id" TEXT, ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "categories" ADD COLUMN "sync_id" TEXT, ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "products"  ADD COLUMN "sync_id" TEXT, ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN "sync_id" TEXT, ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "suppliers" ADD COLUMN "sync_id" TEXT, ADD COLUMN "deleted_at" TIMESTAMP(3);

-- sales: add updatedAt (nullable), backfill from createdAt, then enforce NOT NULL
ALTER TABLE "sales" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "sales" SET "updatedAt" = "createdAt";
ALTER TABLE "sales" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "sales" ADD COLUMN "sync_id" TEXT, ADD COLUMN "deleted_at" TIMESTAMP(3);

-- purchases: same pattern
ALTER TABLE "purchases" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "purchases" SET "updatedAt" = "createdAt";
ALTER TABLE "purchases" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "purchases" ADD COLUMN "sync_id" TEXT, ADD COLUMN "deleted_at" TIMESTAMP(3);

-- line items: sync_id only (created/replaced with their parent)
ALTER TABLE "sale_items"     ADD COLUMN "sync_id" TEXT;
ALTER TABLE "purchase_items" ADD COLUMN "sync_id" TEXT;

-- Unique indexes on sync_id (Postgres allows multiple NULLs)
CREATE UNIQUE INDEX "shops_sync_id_key"          ON "shops"("sync_id");
CREATE UNIQUE INDEX "categories_sync_id_key"     ON "categories"("sync_id");
CREATE UNIQUE INDEX "products_sync_id_key"       ON "products"("sync_id");
CREATE UNIQUE INDEX "customers_sync_id_key"      ON "customers"("sync_id");
CREATE UNIQUE INDEX "suppliers_sync_id_key"      ON "suppliers"("sync_id");
CREATE UNIQUE INDEX "sales_sync_id_key"          ON "sales"("sync_id");
CREATE UNIQUE INDEX "purchases_sync_id_key"      ON "purchases"("sync_id");
CREATE UNIQUE INDEX "sale_items_sync_id_key"     ON "sale_items"("sync_id");
CREATE UNIQUE INDEX "purchase_items_sync_id_key" ON "purchase_items"("sync_id");

-- Indexes to speed up delta-pull (changes since <timestamp>)
CREATE INDEX "purchases_entityId_updatedAt_idx" ON "purchases"("entityId", "updatedAt");
CREATE INDEX "sales_entityId_updatedAt_idx"     ON "sales"("entityId", "updatedAt");
