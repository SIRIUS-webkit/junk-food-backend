-- Backfill sync_id UUIDs for existing rows that were created before offline sync.
-- Uses gen_random_uuid() (Postgres 13+). Rows already having sync_id are untouched.

UPDATE "shops"     SET "sync_id" = gen_random_uuid()::text WHERE "sync_id" IS NULL;
UPDATE "categories" SET "sync_id" = gen_random_uuid()::text WHERE "sync_id" IS NULL;
UPDATE "products"  SET "sync_id" = gen_random_uuid()::text WHERE "sync_id" IS NULL;
UPDATE "customers" SET "sync_id" = gen_random_uuid()::text WHERE "sync_id" IS NULL;
UPDATE "suppliers" SET "sync_id" = gen_random_uuid()::text WHERE "sync_id" IS NULL;
UPDATE "purchases" SET "sync_id" = gen_random_uuid()::text WHERE "sync_id" IS NULL;
UPDATE "sales"     SET "sync_id" = gen_random_uuid()::text WHERE "sync_id" IS NULL;
UPDATE "purchase_items" SET "sync_id" = gen_random_uuid()::text WHERE "sync_id" IS NULL;
UPDATE "sale_items"     SET "sync_id" = gen_random_uuid()::text WHERE "sync_id" IS NULL;
