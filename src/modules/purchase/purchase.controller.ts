import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';
import { created, ok, paginated } from '../../utils/response';
import { getPageParams } from '../../utils/pagination';
import { resolveEntityId } from '../../utils/scope';
import { createPurchase } from './purchase.service';

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
      include: {
        supplier: { select: { id: true, name: true, phone: true, address: true } },
        shop: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                categoryId: true,
                purchasePrice: true,
                category: { select: { id: true, name: true, pricingType: true, unit: true } },
              },
            },
          },
        },
        _count: { select: { items: true } },
      },
    }),
    prisma.purchase.count({ where }),
  ]);
  return paginated(res, items, total, page, pageSize);
}

export async function getOne(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const purchase = await prisma.purchase.findFirst({
    where: { id: Number(req.params.id), entityId },
    include: {
      supplier: true,
      shop: { select: { id: true, name: true } },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              code: true,
              categoryId: true,
              purchasePrice: true,
              category: { select: { id: true, name: true, pricingType: true, unit: true } },
            },
          },
        },
      },
    },
  });
  if (!purchase) throw ApiError.notFound('Purchase not found');
  return ok(res, purchase);
}

export async function create(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const createdById = req.user?.actor === 'SUB_USER' ? req.user.id : undefined;
  const purchase = await createPurchase({ ...req.body, entityId, createdById });
  return created(res, purchase, 'Purchase recorded');
}
