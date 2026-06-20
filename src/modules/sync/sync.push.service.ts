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
  const category = await prisma.category.create({
    data: {
      entityId,
      syncId,
      parentId: data.parentId != null ? Number(data.parentId) : null,
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

async function upsertPurchase(
  entityId: number,
  syncId: string,
  op: SyncOp,
  data: Record<string, unknown> = {},
  createdById?: number,
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
  const items = (data.items as CreatePurchaseInput['items'] | undefined) ?? [];
  const input: CreatePurchaseInput & { syncId: string } = {
    entityId,
    syncId,
    shopId: Number(data.shopId),
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
  const items = (data.items as CreateSaleInput['items'] | undefined) ?? [];
  const input: CreateSaleInput & { syncId: string } = {
    entityId,
    syncId,
    shopId: Number(data.shopId),
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
  return [...mutations].sort(
    (a, b) => ENTITY_ORDER.indexOf(a.entity) - ENTITY_ORDER.indexOf(b.entity),
  );
}

export async function pushMutations(
  entityId: number,
  mutations: SyncMutation[],
  createdById?: number,
): Promise<SyncPushResult[]> {
  const sorted = sortMutations(mutations);
  const results: SyncPushResult[] = [];

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
          ));
          break;
        case 'purchases':
          ({ id: serverId } = await upsertPurchase(
            entityId,
            mutation.syncId,
            mutation.op,
            mutation.data,
            createdById,
          ));
          break;
        case 'sales':
          ({ id: serverId } = await upsertSale(
            entityId,
            mutation.syncId,
            mutation.op,
            mutation.data,
            createdById,
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
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Sync push failed';
      results.push({ syncId: mutation.syncId, ok: false, error: message });
    }
  }

  return serializeForJson(results);
}
