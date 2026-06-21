import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';
import { createPurchase, type CreatePurchaseInput } from '../purchase/purchase.service';
import { createSale, type CreateSaleInput } from '../sale/sale.service';
import { serializeForJson } from './sync.serialize';

export type SyncEntity =
  | 'shops'
  | 'categories'
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'purchases'
  | 'sales';

export type SyncOp = 'create' | 'update' | 'delete';

export interface SyncMutation {
  entity: SyncEntity;
  op: SyncOp;
  syncId: string;
  data?: Record<string, unknown>;
}

export interface SyncPushResult {
  syncId: string;
  ok: boolean;
  serverId?: number;
  error?: string;
}

async function assertSyncIdFree(
  entity: SyncEntity,
  syncId: string,
  entityId: number,
): Promise<void> {
  const tables: Record<SyncEntity, () => Promise<{ id: number } | null>> = {
    shops: () => prisma.shop.findFirst({ where: { syncId, entityId }, select: { id: true } }),
    categories: () =>
      prisma.category.findFirst({ where: { syncId, entityId }, select: { id: true } }),
    products: () =>
      prisma.product.findFirst({ where: { syncId, entityId }, select: { id: true } }),
    customers: () =>
      prisma.customer.findFirst({ where: { syncId, entityId }, select: { id: true } }),
    suppliers: () =>
      prisma.supplier.findFirst({ where: { syncId, entityId }, select: { id: true } }),
    purchases: () =>
      prisma.purchase.findFirst({ where: { syncId, entityId }, select: { id: true } }),
    sales: () => prisma.sale.findFirst({ where: { syncId, entityId }, select: { id: true } }),
  };
  const existing = await tables[entity]();
  if (existing) throw ApiError.conflict(`${entity} syncId already exists`);
}

async function resolveSupplierId(
  entityId: number,
  data: Record<string, unknown>,
): Promise<number | null | undefined> {
  if (data.supplierId != null) return Number(data.supplierId);
  const supplierSyncId = data.supplierSyncId as string | undefined;
  if (!supplierSyncId) return data.supplierId === null ? null : undefined;
  const supplier = await prisma.supplier.findFirst({
    where: { syncId: supplierSyncId, entityId },
    select: { id: true },
  });
  if (!supplier) throw ApiError.badRequest(`Supplier syncId ${supplierSyncId} not found`);
  return supplier.id;
}

async function resolveCustomerId(
  entityId: number,
  data: Record<string, unknown>,
): Promise<number | null | undefined> {
  if (data.customerId != null) return Number(data.customerId);
  const customerSyncId = data.customerSyncId as string | undefined;
  if (!customerSyncId) return data.customerId === null ? null : undefined;
  const customer = await prisma.customer.findFirst({
    where: { syncId: customerSyncId, entityId },
    select: { id: true },
  });
  if (!customer) throw ApiError.badRequest(`Customer syncId ${customerSyncId} not found`);
  return customer.id;
}

async function resolveShopId(
  entityId: number,
  data: Record<string, unknown>,
  batchIds: Map<string, number>,
): Promise<number> {
  const shopSyncId = data.shopSyncId as string | undefined;
  if (shopSyncId) {
    const fromBatch = batchIds.get(shopSyncId);
    if (fromBatch != null) return fromBatch;
    const shop = await prisma.shop.findFirst({
      where: { syncId: shopSyncId, entityId },
      select: { id: true },
    });
    if (!shop) throw ApiError.badRequest(`Shop syncId ${shopSyncId} not found`);
    return shop.id;
  }

  if (data.shopId != null) {
    const shopId = Number(data.shopId);
    if (shopId > 0) {
      const shop = await prisma.shop.findFirst({
        where: { id: shopId, entityId },
        select: { id: true },
      });
      if (shop) return shopId;
      throw ApiError.badRequest(`Shop id ${shopId} not found for this entity`);
    }
  }

  throw ApiError.badRequest('Purchase/sale missing shopId or shopSyncId');
}

async function resolveCategoryParentId(
  entityId: number,
  data: Record<string, unknown>,
  batchIds: Map<string, number>,
): Promise<number | null> {
  const parentSyncId = data.parentSyncId as string | undefined;
  if (parentSyncId) {
    const fromBatch = batchIds.get(parentSyncId);
    if (fromBatch != null) return fromBatch;
    const parent = await prisma.category.findFirst({
      where: { syncId: parentSyncId, entityId },
      select: { id: true },
    });
    if (!parent) {
      throw ApiError.badRequest(`Parent category syncId ${parentSyncId} not found`);
    }
    return parent.id;
  }

  if (data.parentId == null) return null;

  const parentId = Number(data.parentId);
  const parent = await prisma.category.findFirst({
    where: { id: parentId, entityId },
    select: { id: true },
  });
  if (!parent) {
    throw ApiError.badRequest(
      `Parent category id ${parentId} not found — sync parent group first`,
    );
  }
  return parent.id;
}

async function upsertSupplier(
  entityId: number,
  syncId: string,
  op: SyncOp,
  data: Record<string, unknown> = {},
): Promise<{ id: number }> {
  const existing = await prisma.supplier.findFirst({ where: { syncId, entityId } });
  if (op === 'delete') {
    if (!existing) return { id: 0 };
    await prisma.supplier.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { id: existing.id };
  }
  if (existing) {
    const updated = await prisma.supplier.update({
      where: { id: existing.id },
      data: {
        name: String(data.name ?? existing.name),
        phone: (data.phone as string | null | undefined) ?? existing.phone,
        email: (data.email as string | null | undefined) ?? existing.email,
        address: (data.address as string | null | undefined) ?? existing.address,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : existing.isActive,
        deletedAt: null,
      },
    });
    return { id: updated.id };
  }
  if (op === 'update') throw ApiError.notFound('Supplier not found for update');
  await assertSyncIdFree('suppliers', syncId, entityId);
  const created = await prisma.supplier.create({
    data: {
      entityId,
      syncId,
      name: String(data.name ?? ''),
      phone: (data.phone as string | null | undefined) ?? null,
      email: (data.email as string | null | undefined) ?? null,
      address: (data.address as string | null | undefined) ?? null,
    },
  });
  return { id: created.id };
}

async function upsertCustomer(
  entityId: number,
  syncId: string,
  op: SyncOp,
  data: Record<string, unknown> = {},
): Promise<{ id: number }> {
  const existing = await prisma.customer.findFirst({ where: { syncId, entityId } });
  if (op === 'delete') {
    if (!existing) return { id: 0 };
    await prisma.customer.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { id: existing.id };
  }
  if (existing) {
    const updated = await prisma.customer.update({
      where: { id: existing.id },
      data: {
        name: String(data.name ?? existing.name),
        phone: (data.phone as string | null | undefined) ?? existing.phone,
        email: (data.email as string | null | undefined) ?? existing.email,
        address: (data.address as string | null | undefined) ?? existing.address,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : existing.isActive,
        deletedAt: null,
      },
    });
    return { id: updated.id };
  }
  if (op === 'update') throw ApiError.notFound('Customer not found for update');
  await assertSyncIdFree('customers', syncId, entityId);
  const created = await prisma.customer.create({
    data: {
      entityId,
      syncId,
      name: String(data.name ?? ''),
      phone: (data.phone as string | null | undefined) ?? null,
      email: (data.email as string | null | undefined) ?? null,
      address: (data.address as string | null | undefined) ?? null,
    },
  });
  return { id: created.id };
}

async function upsertShop(
  entityId: number,
  syncId: string,
  op: SyncOp,
  data: Record<string, unknown> = {},
): Promise<{ id: number }> {
  const existing = await prisma.shop.findFirst({ where: { syncId, entityId } });
  if (op === 'delete') {
    if (!existing) return { id: 0 };
    await prisma.shop.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { id: existing.id };
  }
  if (existing) {
    const updated = await prisma.shop.update({
      where: { id: existing.id },
      data: {
        name: String(data.name ?? existing.name),
        description: (data.description as string | null | undefined) ?? existing.description,
        address: (data.address as string | null | undefined) ?? existing.address,
        phone1: (data.phone1 as string | null | undefined) ?? existing.phone1,
        phone2: (data.phone2 as string | null | undefined) ?? existing.phone2,
        inchargeName: (data.inchargeName as string | null | undefined) ?? existing.inchargeName,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : existing.isActive,
        deletedAt: null,
      },
    });
    return { id: updated.id };
  }
  if (op === 'update') throw ApiError.notFound('Shop not found for update');
  await assertSyncIdFree('shops', syncId, entityId);
  const code = String(data.code ?? `SH-${syncId.slice(0, 8)}`);
  const created = await prisma.shop.create({
    data: {
      entityId,
      syncId,
      code,
      name: String(data.name ?? code),
      description: (data.description as string | null | undefined) ?? null,
      address: (data.address as string | null | undefined) ?? null,
      phone1: (data.phone1 as string | null | undefined) ?? null,
      phone2: (data.phone2 as string | null | undefined) ?? null,
      inchargeName: (data.inchargeName as string | null | undefined) ?? null,
    },
  });
  return { id: created.id };
}

async function upsertCategory(
  entityId: number,
  syncId: string,
  op: SyncOp,
  data: Record<string, unknown> = {},
  batchIds: Map<string, number>,
): Promise<{ id: number }> {
  const existing = await prisma.category.findFirst({ where: { syncId, entityId } });
  if (op === 'delete') {
    if (!existing) return { id: 0 };
    await prisma.category.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { id: existing.id };
  }
  if (existing) {
    const updated = await prisma.category.update({
      where: { id: existing.id },
      data: {
        name: String(data.name ?? existing.name),
        description: (data.description as string | null | undefined) ?? existing.description,
        pricingType: (data.pricingType as string | undefined) ?? existing.pricingType,
        pricePerUnit:
          data.pricePerUnit !== undefined
            ? new Prisma.Decimal(Number(data.pricePerUnit))
            : existing.pricePerUnit,
        unit: (data.unit as string | undefined) ?? existing.unit,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : existing.isActive,
        deletedAt: null,
      },
    });
    return { id: updated.id };
  }
  if (op === 'update') throw ApiError.notFound('Category not found for update');
  await assertSyncIdFree('categories', syncId, entityId);
  const isGroup = Boolean(data.isGroup);
  const pt = String(data.pricingType ?? 'weight');
  const price = Number(data.pricePerUnit ?? 0);
  const unit = String(data.unit ?? (pt === 'weight' ? 'viss' : 'piece'));
  const parentId = await resolveCategoryParentId(entityId, data, batchIds);
  const category = await prisma.category.create({
    data: {
      entityId,
      syncId,
      parentId,
      isGroup,
      name: String(data.name ?? ''),
      description: (data.description as string | null | undefined) ?? null,
      pricingType: isGroup ? 'weight' : pt,
      pricePerUnit: isGroup ? 0 : price,
      unit: isGroup ? 'viss' : unit,
    },
  });
  if (!isGroup) {
    const productSyncId = (data.productSyncId as string | undefined) ?? `${syncId}-product`;
    const existingProduct = await prisma.product.findFirst({
      where: { syncId: productSyncId, entityId },
    });
    if (!existingProduct) {
      await prisma.product.create({
        data: {
          entityId,
          syncId: productSyncId,
          categoryId: category.id,
          name: category.name,
          purchasePrice: new Prisma.Decimal(price),
          salePrice: new Prisma.Decimal(price),
        },
      });
    }
  }
  return { id: category.id };
}

/**
 * Resolve purchase/sale line items to concrete server productIds. Items created
 * offline reference the product by `productSyncId` (the product has no server id
 * yet); since categories — which create their product — are pushed before
 * purchases/sales, the product row exists by now and we look it up by syncId.
 */
async function resolvePushItems(
  entityId: number,
  rawItems: Array<Record<string, unknown>>,
): Promise<{ productId: number; quantity: number; unitPrice: number; syncId?: string }[]> {
  return Promise.all(
    rawItems.map(async (it) => {
      const productSyncId = it.productSyncId as string | undefined;
      let productId = it.productId != null ? Number(it.productId) : null;

      if (productId != null) {
        const byId = await prisma.product.findFirst({
          where: { id: productId, entityId },
          select: { id: true },
        });
        if (!byId) productId = null;
      }

      if (productId == null) {
        if (!productSyncId) {
          throw ApiError.badRequest('Line item missing productId and productSyncId');
        }
        const product = await prisma.product.findFirst({
          where: { syncId: productSyncId, entityId },
          select: { id: true },
        });
        if (!product) {
          throw ApiError.badRequest(`Product syncId ${productSyncId} not found — sync category first`);
        }
        productId = product.id;
      }
      return {
        productId,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        syncId: it.syncId as string | undefined,
      };
    }),
  );
}

async function upsertPurchase(
  entityId: number,
  syncId: string,
  op: SyncOp,
  data: Record<string, unknown> = {},
  createdById?: number,
  batchIds: Map<string, number> = new Map(),
): Promise<{ id: number }> {
  const existing = await prisma.purchase.findFirst({
    where: { syncId, entityId },
    select: { id: true },
  });

  if (op === 'delete') {
    if (!existing) return { id: 0 };
    await prisma.purchase.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
    return { id: existing.id };
  }

  if (existing) return { id: existing.id };
  if (op === 'update') throw ApiError.badRequest('Purchase update via sync not supported yet');

  const supplierId = await resolveSupplierId(entityId, data);
  const shopId = await resolveShopId(entityId, data, batchIds);
  const items = await resolvePushItems(
    entityId,
    (data.items as Array<Record<string, unknown>> | undefined) ?? [],
  );
  const input: CreatePurchaseInput & { syncId: string } = {
    entityId,
    syncId,
    shopId,
    supplierId: supplierId ?? null,
    refNo: String(data.refNo ?? `POS-${syncId.slice(0, 8)}`),
    note: (data.note as string | undefined) ?? undefined,
    purchasedAt: data.purchasedAt as string | undefined,
    items,
    createdById,
    addStock: data.addStock !== false,
  };
  const purchase = await createPurchase(input);
  return { id: purchase.id };
}

async function upsertSale(
  entityId: number,
  syncId: string,
  op: SyncOp,
  data: Record<string, unknown> = {},
  createdById?: number,
  batchIds: Map<string, number> = new Map(),
): Promise<{ id: number }> {
  const existing = await prisma.sale.findFirst({
    where: { syncId, entityId },
    select: { id: true },
  });

  if (op === 'delete') {
    if (!existing) return { id: 0 };
    await prisma.sale.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
    return { id: existing.id };
  }

  if (existing) return { id: existing.id };
  if (op === 'update') throw ApiError.badRequest('Sale update via sync not supported yet');

  const customerId = await resolveCustomerId(entityId, data);
  const shopId = await resolveShopId(entityId, data, batchIds);
  const items = await resolvePushItems(
    entityId,
    (data.items as Array<Record<string, unknown>> | undefined) ?? [],
  );
  const input: CreateSaleInput & { syncId: string } = {
    entityId,
    syncId,
    shopId,
    customerId: customerId ?? null,
    invoiceNo: String(data.invoiceNo ?? `SALE-${syncId.slice(0, 8)}`),
    note: (data.note as string | undefined) ?? undefined,
    soldAt: data.soldAt as string | undefined,
    items,
    createdById,
    deductStock: data.deductStock !== false,
  };
  const sale = await createSale(input);
  return { id: sale.id };
}

const ENTITY_ORDER: SyncEntity[] = [
  'shops',
  'categories',
  'products',
  'suppliers',
  'customers',
  'purchases',
  'sales',
];

function sortMutations(mutations: SyncMutation[]): SyncMutation[] {
  return [...mutations].sort((a, b) => {
    const entityOrder =
      ENTITY_ORDER.indexOf(a.entity) - ENTITY_ORDER.indexOf(b.entity);
    if (entityOrder !== 0) return entityOrder;

    // Parent category groups before child leaf categories in the same batch.
    if (a.entity === 'categories' && b.entity === 'categories') {
      const aHasParent = a.data?.parentId != null || a.data?.parentSyncId != null;
      const bHasParent = b.data?.parentId != null || b.data?.parentSyncId != null;
      return Number(aHasParent) - Number(bHasParent);
    }

    return 0;
  });
}

export async function pushMutations(
  entityId: number,
  mutations: SyncMutation[],
  createdById?: number,
): Promise<SyncPushResult[]> {
  const sorted = sortMutations(mutations);
  const results: SyncPushResult[] = [];
  const batchIds = new Map<string, number>();

  for (const mutation of sorted) {
    try {
      let serverId = 0;
      switch (mutation.entity) {
        case 'suppliers':
          ({ id: serverId } = await upsertSupplier(
            entityId,
            mutation.syncId,
            mutation.op,
            mutation.data,
          ));
          break;
        case 'customers':
          ({ id: serverId } = await upsertCustomer(
            entityId,
            mutation.syncId,
            mutation.op,
            mutation.data,
          ));
          break;
        case 'shops':
          ({ id: serverId } = await upsertShop(
            entityId,
            mutation.syncId,
            mutation.op,
            mutation.data,
          ));
          break;
        case 'categories':
          ({ id: serverId } = await upsertCategory(
            entityId,
            mutation.syncId,
            mutation.op,
            mutation.data,
            batchIds,
          ));
          break;
        case 'purchases':
          ({ id: serverId } = await upsertPurchase(
            entityId,
            mutation.syncId,
            mutation.op,
            mutation.data,
            createdById,
            batchIds,
          ));
          break;
        case 'sales':
          ({ id: serverId } = await upsertSale(
            entityId,
            mutation.syncId,
            mutation.op,
            mutation.data,
            createdById,
            batchIds,
          ));
          break;
        case 'products':
          // Products are created with categories; standalone product push is a no-op for now.
          serverId = 0;
          break;
        default:
          throw ApiError.badRequest(`Unknown sync entity: ${mutation.entity as string}`);
      }
      results.push({
        syncId: mutation.syncId,
        ok: true,
        serverId: serverId || undefined,
      });
      if (serverId) batchIds.set(mutation.syncId, serverId);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Sync push failed';
      results.push({ syncId: mutation.syncId, ok: false, error: message });
    }
  }

  return serializeForJson(results);
}
