import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';

export interface PurchaseItemInput {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface CreatePurchaseInput {
  entityId: number;
  shopId: number;
  supplierId?: number | null;
  refNo: string;
  note?: string;
  purchasedAt?: string;
  items: PurchaseItemInput[];
  createdById?: number;
  addStock?: boolean; // default true
}

// Create a purchase, its line items, and (optionally) increment on-hand stock.
export async function createPurchase(input: CreatePurchaseInput) {
  if (!input.items.length) throw ApiError.badRequest('A purchase must have at least one item');
  const add = input.addStock !== false;

  return prisma.$transaction(async (tx) => {
    const shop = await tx.shop.findFirst({ where: { id: input.shopId, entityId: input.entityId } });
    if (!shop) throw ApiError.badRequest('Shop not found for this entity');
    if (input.supplierId) {
      const s = await tx.supplier.findFirst({ where: { id: input.supplierId, entityId: input.entityId } });
      if (!s) throw ApiError.badRequest('Supplier not found for this entity');
    }

    let total = new Prisma.Decimal(0);
    const itemsData = [];
    for (const it of input.items) {
      const product = await tx.product.findFirst({ where: { id: it.productId, entityId: input.entityId } });
      if (!product) throw ApiError.badRequest(`Product ${it.productId} not found for this entity`);
      const lineTotal = new Prisma.Decimal(it.quantity).mul(it.unitPrice);
      total = total.add(lineTotal);
      itemsData.push({
        productId: it.productId,
        quantity: new Prisma.Decimal(it.quantity),
        unitPrice: new Prisma.Decimal(it.unitPrice),
        lineTotal,
      });

      if (add) {
        const stock = await tx.stock.findUnique({
          where: { shopId_productId: { shopId: input.shopId, productId: it.productId } },
        });
        const next = (stock ? new Prisma.Decimal(stock.quantity) : new Prisma.Decimal(0)).add(it.quantity);
        if (stock) {
          await tx.stock.update({ where: { id: stock.id }, data: { quantity: next } });
        } else {
          await tx.stock.create({
            data: { entityId: input.entityId, shopId: input.shopId, productId: it.productId, quantity: next },
          });
        }
        await tx.stockTransaction.create({
          data: {
            entityId: input.entityId,
            shopId: input.shopId,
            productId: it.productId,
            type: 'PURCHASE',
            quantity: new Prisma.Decimal(it.quantity),
            note: `Purchase ${input.refNo}`,
            createdById: input.createdById,
          },
        });
      }
    }

    const purchase = await tx.purchase.create({
      data: {
        entityId: input.entityId,
        shopId: input.shopId,
        supplierId: input.supplierId ?? null,
        refNo: input.refNo,
        note: input.note,
        purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : undefined,
        total,
        createdById: input.createdById,
        items: { create: itemsData },
      },
      include: { items: true },
    });
    return purchase;
  });
}
