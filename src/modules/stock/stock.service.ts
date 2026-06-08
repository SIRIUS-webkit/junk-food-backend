import { Prisma, StockTxnType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';

type Tx = Prisma.TransactionClient;

// Apply a signed quantity delta to the on-hand balance for (shop, product),
// creating the Stock row if missing. Prevents negative stock.
async function applyDelta(
  tx: Tx,
  entityId: number,
  shopId: number,
  productId: number,
  delta: Prisma.Decimal.Value,
) {
  const stock = await tx.stock.findUnique({ where: { shopId_productId: { shopId, productId } } });
  const current = stock ? new Prisma.Decimal(stock.quantity) : new Prisma.Decimal(0);
  const next = current.add(new Prisma.Decimal(delta));
  if (next.lessThan(0)) {
    throw ApiError.badRequest('Insufficient stock for this operation');
  }
  if (stock) {
    await tx.stock.update({ where: { id: stock.id }, data: { quantity: next } });
  } else {
    await tx.stock.create({ data: { entityId, shopId, productId, quantity: next } });
  }
  return next;
}

async function assertShopAndProduct(tx: Tx, entityId: number, shopId: number, productId: number) {
  const [shop, product] = await Promise.all([
    tx.shop.findFirst({ where: { id: shopId, entityId } }),
    tx.product.findFirst({ where: { id: productId, entityId } }),
  ]);
  if (!shop) throw ApiError.badRequest('Shop not found for this entity');
  if (!product) throw ApiError.badRequest('Product not found for this entity');
}

export interface AdjustInput {
  entityId: number;
  shopId: number;
  productId: number;
  quantity: number; // positive amount
  note?: string;
  createdById?: number;
}

// Damage / loss: decrease on-hand. type = DAMAGE | LOSS.
export async function recordDamageOrLoss(input: AdjustInput, type: 'DAMAGE' | 'LOSS') {
  return prisma.$transaction(async (tx) => {
    await assertShopAndProduct(tx, input.entityId, input.shopId, input.productId);
    const delta = new Prisma.Decimal(input.quantity).negated();
    const balance = await applyDelta(tx, input.entityId, input.shopId, input.productId, delta);
    const txn = await tx.stockTransaction.create({
      data: {
        entityId: input.entityId,
        shopId: input.shopId,
        productId: input.productId,
        type: type as StockTxnType,
        quantity: delta,
        note: input.note,
        createdById: input.createdById,
      },
    });
    return { transaction: txn, balance };
  });
}

export interface SetBalanceInput {
  entityId: number;
  shopId: number;
  productId: number;
  quantity: number; // the new absolute on-hand value
  note?: string;
  createdById?: number;
}

// Balance update: set on-hand to an absolute value, recording the difference
// as an ADJUSTMENT transaction.
export async function setBalance(input: SetBalanceInput) {
  return prisma.$transaction(async (tx) => {
    await assertShopAndProduct(tx, input.entityId, input.shopId, input.productId);
    const stock = await tx.stock.findUnique({
      where: { shopId_productId: { shopId: input.shopId, productId: input.productId } },
    });
    const current = stock ? new Prisma.Decimal(stock.quantity) : new Prisma.Decimal(0);
    const target = new Prisma.Decimal(input.quantity);
    const delta = target.sub(current);

    if (stock) {
      await tx.stock.update({ where: { id: stock.id }, data: { quantity: target } });
    } else {
      await tx.stock.create({
        data: { entityId: input.entityId, shopId: input.shopId, productId: input.productId, quantity: target },
      });
    }
    const txn = await tx.stockTransaction.create({
      data: {
        entityId: input.entityId,
        shopId: input.shopId,
        productId: input.productId,
        type: 'ADJUSTMENT',
        quantity: delta,
        note: input.note ?? 'Balance update',
        createdById: input.createdById,
      },
    });
    return { transaction: txn, balance: target };
  });
}

export interface TransferInput {
  entityId: number;
  fromShopId: number;
  toShopId: number;
  productId: number;
  quantity: number;
  note?: string;
  createdById?: number;
}

// Stock transfer: move quantity from one shop to another (same entity).
export async function transferStock(input: TransferInput) {
  if (input.fromShopId === input.toShopId) {
    throw ApiError.badRequest('Source and destination shops must differ');
  }
  if (input.quantity <= 0) throw ApiError.badRequest('Quantity must be positive');

  return prisma.$transaction(async (tx) => {
    await assertShopAndProduct(tx, input.entityId, input.fromShopId, input.productId);
    const toShop = await tx.shop.findFirst({ where: { id: input.toShopId, entityId: input.entityId } });
    if (!toShop) throw ApiError.badRequest('Destination shop not found for this entity');

    const transferId = `TRF-${Date.now()}-${input.productId}`;
    const out = new Prisma.Decimal(input.quantity).negated();
    const inc = new Prisma.Decimal(input.quantity);

    const fromBalance = await applyDelta(tx, input.entityId, input.fromShopId, input.productId, out);
    const toBalance = await applyDelta(tx, input.entityId, input.toShopId, input.productId, inc);

    await tx.stockTransaction.createMany({
      data: [
        {
          entityId: input.entityId,
          shopId: input.fromShopId,
          productId: input.productId,
          type: 'TRANSFER_OUT',
          quantity: out,
          note: input.note,
          transferId,
          toShopId: input.toShopId,
          createdById: input.createdById,
        },
        {
          entityId: input.entityId,
          shopId: input.toShopId,
          productId: input.productId,
          type: 'TRANSFER_IN',
          quantity: inc,
          note: input.note,
          transferId,
          toShopId: input.toShopId,
          createdById: input.createdById,
        },
      ],
    });

    return { transferId, fromBalance, toBalance };
  });
}
