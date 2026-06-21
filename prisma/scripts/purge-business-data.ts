/**
 * Purge operational data while keeping accounts:
 *   KEEP: super_admins, entities, sub_users, user_permissions
 *   DELETE: shops, categories, products, stock, customers, suppliers, sales, purchases, units, banks
 *
 * Usage (Supabase — use DIRECT_URL, port 5432):
 *   PURGE_CONFIRM=yes DIRECT_URL='postgresql://...' npx ts-node prisma/scripts/purge-business-data.ts
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
  },
});

function dbHost(): string {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';
  try {
    return new URL(url.replace(/^postgresql:/, 'http:')).hostname;
  } catch {
    return '(unknown)';
  }
}

async function counts() {
  const [
    shops,
    categories,
    products,
    stocks,
    stockTxns,
    customers,
    suppliers,
    sales,
    purchases,
    units,
    banks,
    entities,
    subUsers,
    superAdmins,
  ] = await Promise.all([
    prisma.shop.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.stock.count(),
    prisma.stockTransaction.count(),
    prisma.customer.count(),
    prisma.supplier.count(),
    prisma.sale.count(),
    prisma.purchase.count(),
    prisma.unit.count(),
    prisma.bank.count(),
    prisma.entity.count(),
    prisma.subUser.count(),
    prisma.superAdmin.count(),
  ]);

  return {
    shops,
    categories,
    products,
    stocks,
    stockTxns,
    customers,
    suppliers,
    sales,
    purchases,
    units,
    banks,
    entities,
    subUsers,
    superAdmins,
  };
}

async function main() {
  if (process.env.PURGE_CONFIRM !== 'yes') {
    throw new Error('Set PURGE_CONFIRM=yes to run this destructive script.');
  }

  const host = dbHost();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === 'db';
  if (isLocal && process.env.PURGE_ALLOW_LOCAL !== 'yes') {
    throw new Error(
      `Refusing to purge local database (${host}). Set PURGE_ALLOW_LOCAL=yes if intentional.`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(`Target database host: ${host}`);
  // eslint-disable-next-line no-console
  console.log('Before:', await counts());

  await prisma.$transaction(async (tx) => {
    await tx.saleItem.deleteMany();
    await tx.purchaseItem.deleteMany();
    await tx.sale.deleteMany();
    await tx.purchase.deleteMany();
    await tx.stockTransaction.deleteMany();
    await tx.stock.deleteMany();
    await tx.product.deleteMany();
    // Leaf categories first (parent_id set), then groups.
    await tx.category.deleteMany({ where: { parentId: { not: null } } });
    await tx.category.deleteMany();
    await tx.customer.deleteMany();
    await tx.supplier.deleteMany();
    await tx.unit.deleteMany();
    await tx.bank.deleteMany();
    await tx.shop.deleteMany();
  });

  // eslint-disable-next-line no-console
  console.log('After:', await counts());
  // eslint-disable-next-line no-console
  console.log('✅ Business data purged. Users and entities kept.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
