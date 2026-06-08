import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';
import { created, ok, paginated } from '../../utils/response';
import { getPageParams } from '../../utils/pagination';
import { resolveEntityId } from '../../utils/scope';
import { createSale } from './sale.service';

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
      include: {
        customer: { select: { id: true, name: true } },
        shop: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.sale.count({ where }),
  ]);
  return paginated(res, items, total, page, pageSize);
}

export async function getOne(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const sale = await prisma.sale.findFirst({
    where: { id: Number(req.params.id), entityId },
    include: {
      customer: true,
      shop: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, code: true } } } },
    },
  });
  if (!sale) throw ApiError.notFound('Sale not found');
  return ok(res, sale);
}

export async function create(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const createdById = req.user?.actor === 'SUB_USER' ? req.user.id : undefined;
  const sale = await createSale({ ...req.body, entityId, createdById });
  return created(res, sale, 'Sale recorded');
}
