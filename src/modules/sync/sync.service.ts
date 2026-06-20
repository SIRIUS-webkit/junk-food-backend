import { prisma } from '../../lib/prisma';
import { serializeForJson } from './sync.serialize';

/**
 * Maximum rows returned per resource in a single pull. If a resource hits this
 * cap the client should pull again with `since` = the largest updatedAt it received
 * (delta sync converges over a few calls). Generous for single-shop datasets.
 */
const PAGE_CAP = 1000;

export interface PullResult {
  serverTime: string;
  changes: Record<string, unknown[]>;
}

/**
 * Delta pull: every syncable row in the entity changed (created/updated/soft-deleted)
 * strictly after `since`. `since` omitted = full snapshot (initial sync).
 *
 * Soft-deletes arrive as normal rows carrying a non-null `deletedAt` (tombstones),
 * because setting `deletedAt` bumps `updatedAt` (@updatedAt).
 */
export async function pullChanges(entityId: number, since?: string): Promise<PullResult> {
  const after = since ? new Date(since) : new Date(0);
  const where = { entityId, updatedAt: { gt: after } };
  const take = PAGE_CAP;

  const [shops, categories, products, customers, suppliers, purchases, sales, stock] =
    await Promise.all([
      prisma.shop.findMany({ where, orderBy: { updatedAt: 'asc' }, take }),
      prisma.category.findMany({ where, orderBy: { updatedAt: 'asc' }, take }),
      prisma.product.findMany({ where, orderBy: { updatedAt: 'asc' }, take }),
      prisma.customer.findMany({ where, orderBy: { updatedAt: 'asc' }, take }),
      prisma.supplier.findMany({ where, orderBy: { updatedAt: 'asc' }, take }),
      prisma.purchase.findMany({
        where,
        orderBy: { updatedAt: 'asc' },
        take,
        include: { items: true },
      }),
      prisma.sale.findMany({
        where,
        orderBy: { updatedAt: 'asc' },
        take,
        include: { items: true },
      }),
      // Stock is server-derived (pull-only): always send a full snapshot so the
      // client materialized stock_balances table stays complete offline.
      prisma.stock.findMany({
        where: { entityId },
        orderBy: { id: 'asc' },
        take,
      }),
    ]);

  return serializeForJson({
    serverTime: new Date().toISOString(),
    changes: { shops, categories, products, customers, suppliers, purchases, sales, stock },
  });
}
