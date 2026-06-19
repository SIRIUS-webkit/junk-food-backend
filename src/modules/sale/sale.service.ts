import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';

export interface SaleItemInput {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface CreateSaleInput {
  entityId: number;
  shopId: number;
  customerId?: number | null;
  invoiceNo: string;
  note?: string;
  soldAt?: string;
  items: SaleItemInput[];
  createdById?: number;
  deductStock?: boolean; // default true
}

// Create a sale, its line items, and (optionally) decrement on-hand stock,
// all in one transaction.
export async function createSale(input: CreateSaleInput) {
  if (!input.items.length) throw ApiError.badRequest('A sale must have at least one item');
  const deduct = input.deductStock !== false;

  return prisma.$transaction(async (tx) => {
    const shop = await tx.shop.findFirst({ where: { id: input.shopId, entityId: input.entityId } });
    if (!shop) throw ApiError.badRequest('Shop not found for this entity');
    if (input.customerId) {
      const c = await tx.customer.findFirst({ where: { id: input.customerId, entityId: input.entityId } });
      if (!c) throw ApiError.badRequest('Customer not found for this entity');
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

      if (deduct) {
        const stock = await tx.stock.findUnique({
          where: { shopId_productId: { shopId: input.shopId, productId: it.productId } },
        });
        const current = stock ? new Prisma.Decimal(stock.quantity) : new Prisma.Decimal(0);
        const next = current.sub(it.quantity);
        if (next.lessThan(0)) {
          throw ApiError.badRequest(
            `Insufficient stock for product ${product.name}. Available: ${current.toString()}, requested: ${it.quantity}`,
          );
        }
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
            type: 'SALE',
            quantity: new Prisma.Decimal(it.quantity).negated(),
            note: `Sale ${input.invoiceNo}`,
            createdById: input.createdById,
          },
        });
      }
    }

    const sale = await tx.sale.create({
      data: {
        entityId: input.entityId,
        shopId: input.shopId,
        customerId: input.customerId ?? null,
        invoiceNo: input.invoiceNo,
        note: input.note,
        soldAt: input.soldAt ? new Date(input.soldAt) : undefined,
        total,
        createdById: input.createdById,
        items: { create: itemsData },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, address: true } },
        shop: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                categoryId: true,
                category: { select: { id: true, name: true, pricingType: true, unit: true, parentId: true } },
              },
            },
          },
        },
      },
    });
    return sale;
  });
}
