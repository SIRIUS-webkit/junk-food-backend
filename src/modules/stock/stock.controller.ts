import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ok, paginated, created } from '../../utils/response';
import { getPageParams } from '../../utils/pagination';
import { resolveEntityId } from '../../utils/scope';
import * as service from './stock.service';

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
        product: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.stock.count({ where }),
  ]);
  return paginated(res, items, total, page, pageSize);
}

// GET /stock/transactions  — movement ledger
export async function listTransactions(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { skip, take, page, pageSize } = getPageParams(req);
  const shopId = req.query.shopId ? Number(req.query.shopId) : undefined;
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  const type = req.query.type as string | undefined;
  const where = {
    entityId,
    ...(shopId ? { shopId } : {}),
    ...(productId ? { productId } : {}),
    ...(type ? { type: type as any } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.stockTransaction.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        shop: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.stockTransaction.count({ where }),
  ]);
  return paginated(res, items, total, page, pageSize);
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
