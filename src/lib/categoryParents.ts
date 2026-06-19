import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export const categoryWithParentRefSelect = {
  id: true,
  name: true,
  pricingType: true,
  unit: true,
  parentId: true,
} as Prisma.CategorySelect;

type CategoryWithParentRef = {
  parentId?: number | null;
  parent?: { id: number; name: string } | null;
};

/** Load parent categories and attach `{ id, name }` under each category that has `parentId`. */
export async function attachCategoryParents<T extends CategoryWithParentRef>(
  categories: (T | null | undefined)[],
): Promise<void> {
  const parentIds = [
    ...new Set(
      categories
        .map((c) => c?.parentId ?? null)
        .filter((id): id is number => id != null),
    ),
  ];
  if (!parentIds.length) return;

  const parents = await prisma.category.findMany({
    where: { id: { in: parentIds } },
    select: { id: true, name: true },
  });
  const byId = new Map(parents.map((p) => [p.id, p]));

  for (const cat of categories) {
    if (!cat?.parentId) continue;
    const parent = byId.get(cat.parentId);
    if (parent) cat.parent = parent;
  }
}

export async function enrichPurchaseCategoryParents<T>(purchases: T[]): Promise<T[]> {
  const categories: (CategoryWithParentRef | null | undefined)[] = [];
  for (const purchase of purchases) {
    const items =
      (purchase as { items?: Array<{ product?: { category?: CategoryWithParentRef | null } }> })
        .items ?? [];
    for (const item of items) {
      categories.push(item.product?.category);
    }
  }
  await attachCategoryParents(categories);
  return purchases;
}
