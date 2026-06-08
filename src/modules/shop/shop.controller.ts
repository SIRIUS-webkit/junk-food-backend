import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';
import { created, ok, paginated } from '../../utils/response';
import { getPageParams } from '../../utils/pagination';
import { resolveEntityId } from '../../utils/scope';

export async function list(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { skip, take, page, pageSize, search } = getPageParams(req);
  const where = {
    entityId,
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.shop.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.shop.count({ where }),
  ]);
  return paginated(res, items, total, page, pageSize);
}

export async function getOne(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const shop = await prisma.shop.findFirst({ where: { id: Number(req.params.id), entityId } });
  if (!shop) throw ApiError.notFound('Shop not found');
  return ok(res, shop);
}

export async function create(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { code, name, description, address, phone1, phone2, inchargeName } = req.body;
  const shop = await prisma.shop.create({
    data: { entityId, code, name, description, address, phone1, phone2, inchargeName },
  });
  return created(res, shop);
}

export async function update(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.shop.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('Shop not found');
  const { code, name, description, address, phone1, phone2, inchargeName, isActive } = req.body;
  const shop = await prisma.shop.update({
    where: { id },
    data: { code, name, description, address, phone1, phone2, inchargeName, isActive },
  });
  return ok(res, shop);
}

export async function remove(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.shop.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('Shop not found');
  await prisma.shop.delete({ where: { id } });
  return ok(res, { id }, 'Shop deleted');
}
