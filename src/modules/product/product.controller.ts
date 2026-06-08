import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';
import { created, ok, paginated } from '../../utils/response';
import { getPageParams } from '../../utils/pagination';
import { resolveEntityId } from '../../utils/scope';

// Ensure a category/unit (if provided) belongs to the same entity.
async function assertRefs(entityId: number, categoryId?: number | null, unitId?: number | null) {
  if (categoryId) {
    const c = await prisma.category.findFirst({ where: { id: categoryId, entityId } });
    if (!c) throw ApiError.badRequest('Category not found for this entity');
  }
  if (unitId) {
    const u = await prisma.unit.findFirst({ where: { id: unitId, entityId } });
    if (!u) throw ApiError.badRequest('Unit not found for this entity');
  }
}

export async function list(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { skip, take, page, pageSize, search } = getPageParams(req);
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
  const where = {
    entityId,
    ...(categoryId ? { categoryId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { code: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { category: { select: { id: true, name: true } }, unit: { select: { id: true, name: true } } },
    }),
    prisma.product.count({ where }),
  ]);
  return paginated(res, items, total, page, pageSize);
}

export async function getOne(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const product = await prisma.product.findFirst({
    where: { id: Number(req.params.id), entityId },
    include: { category: true, unit: true, stocks: { include: { shop: { select: { id: true, name: true } } } } },
  });
  if (!product) throw ApiError.notFound('Product not found');
  return ok(res, product);
}

export async function create(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { code, name, description, categoryId, unitId, purchasePrice, salePrice } = req.body;
  await assertRefs(entityId, categoryId, unitId);
  const product = await prisma.product.create({
    data: {
      entityId,
      code,
      name,
      description,
      categoryId,
      unitId,
      purchasePrice: purchasePrice ?? 0,
      salePrice: salePrice ?? 0,
    },
  });
  return created(res, product);
}

export async function update(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.product.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('Product not found');
  const { code, name, description, categoryId, unitId, purchasePrice, salePrice, isActive } = req.body;
  await assertRefs(entityId, categoryId, unitId);
  const product = await prisma.product.update({
    where: { id },
    data: { code, name, description, categoryId, unitId, purchasePrice, salePrice, isActive },
  });
  return ok(res, product);
}

export async function remove(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.product.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('Product not found');
  await prisma.product.delete({ where: { id } });
  return ok(res, { id }, 'Product deleted');
}
