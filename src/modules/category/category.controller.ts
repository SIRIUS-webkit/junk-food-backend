import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';
import { created, ok, paginated } from '../../utils/response';
import { getPageParams } from '../../utils/pagination';
import { resolveEntityId } from '../../utils/scope';

function slugCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
}

export async function list(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { skip, take, page, pageSize, search } = getPageParams(req);
  const where = {
    entityId,
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.category.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    }),
    prisma.category.count({ where }),
  ]);
  return paginated(res, items, total, page, pageSize);
}

export async function getOne(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const category = await prisma.category.findFirst({
    where: { id: Number(req.params.id), entityId },
  });
  if (!category) throw ApiError.notFound('Category not found');
  return ok(res, category);
}

export async function create(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { name, description, pricingType, pricePerUnit, unit } = req.body;
  const pt = pricingType ?? 'weight';
  const price = pricePerUnit ?? 0;
  const u = unit ?? (pt === 'weight' ? 'kg' : 'piece');

  const result = await prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: {
        entityId,
        name,
        description,
        pricingType: pt,
        pricePerUnit: price,
        unit: u,
      },
    });
    const codeBase = slugCode(name) || `CAT-${category.id}`;
    let code = `POS-${codeBase}`;
    const existing = await tx.product.findFirst({ where: { entityId, code } });
    if (existing) code = `POS-${codeBase}-${category.id}`;

    const product = await tx.product.create({
      data: {
        entityId,
        categoryId: category.id,
        code,
        name,
        purchasePrice: price,
        salePrice: price,
        description: `POS category product (${pt}/${u})`,
      },
    });
    return { category, productId: product.id };
  });

  return created(res, result);
}

export async function update(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.category.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('Category not found');
  const { name, description, isActive, pricingType, pricePerUnit, unit } = req.body;

  const category = await prisma.$transaction(async (tx) => {
    const updated = await tx.category.update({
      where: { id },
      data: { name, description, isActive, pricingType, pricePerUnit, unit },
    });
    const product = await tx.product.findFirst({ where: { entityId, categoryId: id } });
    if (product) {
      await tx.product.update({
        where: { id: product.id },
        data: {
          ...(name ? { name } : {}),
          ...(pricePerUnit !== undefined ? { purchasePrice: pricePerUnit, salePrice: pricePerUnit } : {}),
        },
      });
    }
    return updated;
  });

  return ok(res, category);
}

export async function remove(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.category.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('Category not found');
  await prisma.category.delete({ where: { id } });
  return ok(res, { id }, 'Category deleted');
}
