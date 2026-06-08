-- AlterTable: POS fields on categories for scrap-pos-app
ALTER TABLE "categories" ADD COLUMN "pricing_type" TEXT NOT NULL DEFAULT 'weight';
ALTER TABLE "categories" ADD COLUMN "price_per_unit" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "categories" ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'kg';
