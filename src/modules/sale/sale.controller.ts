import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { categoryWithParentRefSelect, enrichPurchaseCategoryParents } from '../../lib/categoryParents';
import { ApiError } from '../../utils/ApiError';
import { created, ok, paginated } from '../../utils/response';
import { getPageParams } from '../../utils/pagination';
import { resolveEntityId } from '../../utils/scope';
import { createSale } from './sale.service';

const saleProductSelect = {
  id: true,
  name: true,
  code: true,
  categoryId: true,
  salePrice: true,
  category: { select: categoryWithParentRefSelect },
} satisfies Prisma.ProductSelect;

const saleInclude = {
  customer: { select: { id: true, name: true, phone: true, address: true } },
  shop: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: saleProductSelect },
    },
  },
  _count: { select: { items: true } },
} satisfies Prisma.SaleInclude;

const saleDetailInclude = {
  customer: true,
  shop: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: saleProductSelect },
    },
  },
} satisfies Prisma.SaleInclude;

export async function list(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { skip, take, page, pageSize, search } = getPageParams(req);
  const shopId = req.query.shopId ? Number(req.query.shopId) : undefined;
  const customerId = req.query.customerId ? Number(req.query.customerId) : undefined;
  const where = {
    entityId,
    ...(shopId ? { shopId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(search ? { invoiceNo: { contains: search, mode: 'insensitive' as const } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      skip,
      take,
      orderBy: { soldAt: 'desc' },
      include: saleInclude,
    }),
    prisma.sale.count({ where }),
  ]);
  const enriched = await enrichPurchaseCategoryParents(items);
  return paginated(res, enriched, total, page, pageSize);
}

export async function getOne(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const sale = await prisma.sale.findFirst({
    where: { id: Number(req.params.id), entityId },
    include: saleDetailInclude,
  });
  if (!sale) throw ApiError.notFound('Sale not found');
  const [enriched] = await enrichPurchaseCategoryParents([sale]);
  return ok(res, enriched);
}

export async function create(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const createdById = req.user?.actor === 'SUB_USER' ? req.user.id : undefined;
  const sale = await createSale({ ...req.body, entityId, createdById });
  return created(res, sale, 'Sale recorded');
}
