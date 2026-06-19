import { Request, Response } from 'express';
import { Prisma, StockTxnType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ok, paginated, created } from '../../utils/response';
import { getPageParams } from '../../utils/pagination';
import { resolveEntityId } from '../../utils/scope';
import * as service from './stock.service';

const productWithCategory = Prisma.validator<Prisma.ProductDefaultArgs>()({
  include: {
    category: {
      select: {
        id: true,
        name: true,
        pricingType: true,
        unit: true,
        parentId: true,
        isGroup: true,
      } as Prisma.CategorySelect,
    },
  },
});

type StockRowWithCategory = {
  product: {
    category: {
      parentId?: number | null;
      parent?: { id: number; name: string } | null;
    } | null;
  };
};

/** Attach parent category names for stock rows (avoids nested include typing issues). */
async function enrichStockParents<T extends StockRowWithCategory>(rows: T[]): Promise<T[]> {
  const parentIds = [
    ...new Set(
      rows
        .map((r) => r.product.category?.parentId ?? null)
        .filter((id): id is number => id != null),
    ),
  ];
  if (!parentIds.length) return rows;

  const parents = await prisma.category.findMany({
    where: { id: { in: parentIds } },
    select: { id: true, name: true },
  });
  const byId = new Map(parents.map((p) => [p.id, p]));

  return rows.map((row) => {
    const cat = row.product.category;
    if (!cat?.parentId) return row;
    const parent = byId.get(cat.parentId);
    if (!parent) return row;
    return {
      ...row,
      product: {
        ...row.product,
        category: { ...cat, parent },
      },
    };
  });
}

function actorId(req: Request): number | undefined {
  return req.user?.actor === 'SUB_USER' ? req.user.id : undefined;
}

// GET /stock  — current balances (filter by shopId, productId)
export async function listBalances(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { skip, take, page, pageSize } = getPageParams(req);
  const shopId = req.query.shopId ? Number(req.query.shopId) : undefined;
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  const where = { entityId, ...(shopId ? { shopId } : {}), ...(productId ? { productId } : {}) };
  const [items, total] = await Promise.all([
    prisma.stock.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      include: {
        shop: { select: { id: true, name: true } },
        product: productWithCategory,
      },
    }),
    prisma.stock.count({ where }),
  ]);
  const enriched = await enrichStockParents(items as Array<typeof items[number] & StockRowWithCategory>);
  return paginated(res, enriched, total, page, pageSize);
}

// GET /stock/transactions  — movement ledger
export async function listTransactions(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { skip, take, page, pageSize } = getPageParams(req);
  const shopId = req.query.shopId ? Number(req.query.shopId) : undefined;
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  const type = req.query.type as StockTxnType | undefined;
  const where = {
    entityId,
    ...(shopId ? { shopId } : {}),
    ...(productId ? { productId } : {}),
    ...(type ? { type } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.stockTransaction.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        shop: { select: { id: true, name: true } },
        product: productWithCategory,
      },
    }),
    prisma.stockTransaction.count({ where }),
  ]);
  const enriched = await enrichStockParents(items as Array<typeof items[number] & StockRowWithCategory>);
  return paginated(res, enriched, total, page, pageSize);
}

// POST /stock/damage  and  /stock/loss
export async function damage(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { shopId, productId, quantity, note } = req.body;
  const result = await service.recordDamageOrLoss(
    { entityId, shopId, productId, quantity, note, createdById: actorId(req) },
    'DAMAGE',
  );
  return created(res, result, 'Damage recorded');
}

export async function loss(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { shopId, productId, quantity, note } = req.body;
  const result = await service.recordDamageOrLoss(
    { entityId, shopId, productId, quantity, note, createdById: actorId(req) },
    'LOSS',
  );
  return created(res, result, 'Loss recorded');
}

// POST /stock/balance  — set absolute on-hand
export async function balance(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { shopId, productId, quantity, note } = req.body;
  const result = await service.setBalance({
    entityId,
    shopId,
    productId,
    quantity,
    note,
    createdById: actorId(req),
  });
  return ok(res, result, 'Balance updated');
}

// POST /stock/transfer
export async function transfer(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { fromShopId, toShopId, productId, quantity, note } = req.body;
  const result = await service.transferStock({
    entityId,
    fromShopId,
    toShopId,
    productId,
    quantity,
    note,
    createdById: actorId(req),
  });
  return created(res, result, 'Stock transferred');
}
