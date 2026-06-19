import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { categoryWithParentRefSelect, enrichPurchaseCategoryParents } from '../../lib/categoryParents';
import { ApiError } from '../../utils/ApiError';
import { created, ok, paginated } from '../../utils/response';
import { getPageParams } from '../../utils/pagination';
import { resolveEntityId } from '../../utils/scope';
import { createPurchase, deletePurchase } from './purchase.service';

const purchaseProductSelect = {
  id: true,
  name: true,
  code: true,
  categoryId: true,
  purchasePrice: true,
  category: { select: categoryWithParentRefSelect },
} satisfies Prisma.ProductSelect;

const purchaseInclude = {
  supplier: { select: { id: true, name: true, phone: true, address: true } },
  shop: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: purchaseProductSelect },
    },
  },
  _count: { select: { items: true } },
} satisfies Prisma.PurchaseInclude;

const purchaseDetailInclude = {
  supplier: true,
  shop: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: purchaseProductSelect },
    },
  },
} satisfies Prisma.PurchaseInclude;

export async function list(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { skip, take, page, pageSize, search } = getPageParams(req);
  const shopId = req.query.shopId ? Number(req.query.shopId) : undefined;
  const supplierId = req.query.supplierId ? Number(req.query.supplierId) : undefined;
  const where = {
    entityId,
    ...(shopId ? { shopId } : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(search ? { refNo: { contains: search, mode: 'insensitive' as const } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      skip,
      take,
      orderBy: { purchasedAt: 'desc' },
      include: purchaseInclude,
    }),
    prisma.purchase.count({ where }),
  ]);
  const enriched = await enrichPurchaseCategoryParents(items);
  return paginated(res, enriched, total, page, pageSize);
}

export async function getOne(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const purchase = await prisma.purchase.findFirst({
    where: { id: Number(req.params.id), entityId },
    include: purchaseDetailInclude,
  });
  if (!purchase) throw ApiError.notFound('Purchase not found');
  const [enriched] = await enrichPurchaseCategoryParents([purchase]);
  return ok(res, enriched);
}

export async function create(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const createdById = req.user?.actor === 'SUB_USER' ? req.user.id : undefined;
  const purchase = await createPurchase({ ...req.body, entityId, createdById });
  return created(res, purchase, 'Purchase recorded');
}

export async function remove(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const createdById = req.user?.actor === 'SUB_USER' ? req.user.id : undefined;
  const result = await deletePurchase(entityId, Number(req.params.id), createdById);
  return ok(res, result, 'Purchase deleted');
}
