import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
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

const categoryInclude = {
  parent: {
    select: {
      id: true,
      name: true,
      isGroup: true,
    } as Prisma.CategorySelect,
  },
  _count: {
    select: {
      products: true,
      children: true,
    } as Prisma.CategoryCountOutputTypeSelect,
  },
} as Prisma.CategoryInclude;

const groupTreeInclude = {
  children: {
    where: { isActive: true },
    orderBy: { name: 'asc' as const },
    include: categoryInclude,
  },
  _count: {
    select: { children: true } as Prisma.CategoryCountOutputTypeSelect,
  },
} as Prisma.CategoryInclude;

/** Category row shape including hierarchy fields (stable when IDE Prisma types lag schema). */
type CategoryHierarchyRow = {
  id: number;
  entityId: number;
  parentId: number | null;
  isGroup: boolean;
  name: string;
  description: string | null;
  pricingType: string;
  pricePerUnit: Prisma.Decimal;
  unit: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type CategoryWithChildrenCount = CategoryHierarchyRow & {
  _count: { children: number };
};

const groupWhere = (entityId: number): Prisma.CategoryWhereInput =>
  ({ entityId, isGroup: true, parentId: null }) as Prisma.CategoryWhereInput;

const standaloneWhere = (entityId: number): Prisma.CategoryWhereInput =>
  ({ entityId, isGroup: false, parentId: null }) as Prisma.CategoryWhereInput;

async function assertUniqueName(
  entityId: number,
  name: string,
  parentId: number | null | undefined,
  excludeId?: number,
) {
  const existing = await prisma.category.findFirst({
    where: {
      entityId,
      name: { equals: name.trim(), mode: 'insensitive' },
      parentId: parentId ?? null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    } as Prisma.CategoryWhereInput,
  });
  if (existing) {
    throw ApiError.badRequest('A category with this name already exists at this level');
  }
}

async function createLinkedProduct(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  entityId: number,
  categoryId: number,
  name: string,
  pt: string,
  price: number,
  u: string,
) {
  const codeBase = slugCode(name) || `CAT-${categoryId}`;
  let code = `POS-${codeBase}`;
  const existing = await tx.product.findFirst({ where: { entityId, code } });
  if (existing) code = `POS-${codeBase}-${categoryId}`;

  return tx.product.create({
    data: {
      entityId,
      categoryId,
      code,
      name,
      purchasePrice: price,
      salePrice: price,
      description: `POS category product (${pt}/${u})`,
    },
  });
}

export async function list(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const tree = req.query.tree === 'true';
  const parentIdRaw = req.query.parentId;
  const leafOnly = req.query.leafOnly === 'true';

  if (tree) {
    const [groups, standalone] = await Promise.all([
      prisma.category.findMany({
        where: groupWhere(entityId),
        orderBy: { name: 'asc' },
        include: groupTreeInclude,
      }),
      prisma.category.findMany({
        where: standaloneWhere(entityId),
        orderBy: { name: 'asc' },
        include: categoryInclude,
      }),
    ]);
    return ok(res, { groups, standalone });
  }

  const { skip, take, page, pageSize, search } = getPageParams(req);
  const parentId =
    parentIdRaw === 'null' || parentIdRaw === ''
      ? null
      : parentIdRaw !== undefined
        ? Number(parentIdRaw)
        : undefined;

  const where = {
    entityId,
    ...(leafOnly ? { isGroup: false } : {}),
    ...(parentId !== undefined ? { parentId } : {}),
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
  } as Prisma.CategoryWhereInput;

  const [items, total] = await Promise.all([
    prisma.category.findMany({
      where,
      skip,
      take,
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }] as Prisma.CategoryOrderByWithRelationInput[],
      include: categoryInclude,
    }),
    prisma.category.count({ where }),
  ]);
  return paginated(res, items, total, page, pageSize);
}

export async function getOne(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const category = await prisma.category.findFirst({
    where: { id: Number(req.params.id), entityId },
    include: {
      ...categoryInclude,
      children: { orderBy: { name: 'asc' }, include: categoryInclude },
    } as Prisma.CategoryInclude,
  });
  if (!category) throw ApiError.notFound('Category not found');
  return ok(res, category);
}

export async function create(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { name, description, pricingType, pricePerUnit, unit, parentId, isGroup } = req.body;
  const group = Boolean(isGroup);
  const trimmedName = String(name).trim();

  if (parentId) {
    const parent = await prisma.category.findFirst({
      where: {
        id: Number(parentId),
        entityId,
        isGroup: true,
      } as Prisma.CategoryWhereInput,
    });
    if (!parent) throw ApiError.badRequest('Parent group category not found');
  }
  if (group && parentId) {
    throw ApiError.badRequest('Group categories cannot have a parent');
  }

  await assertUniqueName(entityId, trimmedName, parentId ?? null);

  const pt = pricingType ?? 'weight';
  const price = pricePerUnit ?? 0;
  const u = unit ?? (pt === 'weight' ? 'viss' : 'piece');

  if (!group && (pricePerUnit === undefined || Number(pricePerUnit) <= 0)) {
    throw ApiError.badRequest('Price per unit is required for item categories');
  }

  const result = await prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: {
        entityId,
        parentId: parentId ? Number(parentId) : null,
        isGroup: group,
        name: trimmedName,
        description,
        pricingType: group ? 'weight' : pt,
        pricePerUnit: group ? 0 : price,
        unit: group ? 'viss' : u,
      } as Prisma.CategoryUncheckedCreateInput,
    });

    if (group) {
      return { category, productId: null };
    }

    const product = await createLinkedProduct(tx, entityId, category.id, trimmedName, pt, price, u);
    return { category, productId: product.id };
  });

  return created(res, result);
}

export async function update(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = (await prisma.category.findFirst({
    where: { id, entityId },
  })) as CategoryHierarchyRow | null;
  if (!existing) throw ApiError.notFound('Category not found');
  const { name, description, isActive, pricingType, pricePerUnit, unit } = req.body;

  if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
    await assertUniqueName(entityId, name, existing.parentId ?? null, id);
  }

  if (existing.isGroup && (pricingType || pricePerUnit !== undefined || unit)) {
    throw ApiError.badRequest('Group categories do not have pricing');
  }

  const category = await prisma.$transaction(async (tx) => {
    const updated = await tx.category.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        description,
        isActive,
        ...(existing.isGroup
          ? {}
          : {
              pricingType,
              pricePerUnit,
              unit,
            }),
      },
    });
    if (!existing.isGroup) {
      const product = await tx.product.findFirst({ where: { entityId, categoryId: id } });
      if (product) {
        await tx.product.update({
          where: { id: product.id },
          data: {
            ...(name ? { name: name.trim() } : {}),
            ...(pricePerUnit !== undefined ? { purchasePrice: pricePerUnit, salePrice: pricePerUnit } : {}),
          },
        });
      }
    }
    return updated;
  });

  return ok(res, category);
}

export async function remove(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = (await prisma.category.findFirst({
    where: { id, entityId },
    include: {
      _count: { select: { children: true } as Prisma.CategoryCountOutputTypeSelect },
    } as Prisma.CategoryInclude,
  })) as CategoryWithChildrenCount | null;
  if (!existing) throw ApiError.notFound('Category not found');
  if (existing._count.children > 0) {
    throw ApiError.badRequest('Cannot delete a group that still has sub-categories');
  }

  if (!existing.isGroup) {
    const product = await prisma.product.findFirst({ where: { entityId, categoryId: id } });
    if (product) {
      const stock = await prisma.stock.findFirst({ where: { entityId, productId: product.id } });
      if (stock && !stock.quantity.equals(0)) {
        throw ApiError.badRequest('Cannot delete category with remaining stock');
      }
    }
  }

  await prisma.category.delete({ where: { id } });
  return ok(res, { id }, 'Category deleted');
}
