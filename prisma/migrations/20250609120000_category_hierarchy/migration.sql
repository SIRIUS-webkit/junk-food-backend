-- Category hierarchy: main groups (e.g. Bottle) with leaf sub-categories (e.g. Plastic bottle).

ALTER TABLE "categories" ADD COLUMN "parent_id" INTEGER;
ALTER TABLE "categories" ADD COLUMN "is_group" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "categories_entityId_parent_id_idx" ON "categories"("entityId", "parent_id");

-- Drop flat unique name constraint; uniqueness is enforced per parent in application logic.
DROP INDEX IF EXISTS "categories_entityId_name_key";
