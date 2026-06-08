import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ok } from '../../utils/response';
import { resolveEntityId } from '../../utils/scope';

interface Range {
  from?: Date;
  to?: Date;
  shopId?: number;
}

function parseRange(req: Request): Range {
  const fromRaw = req.query.from as string | undefined;
  const toRaw = req.query.to as string | undefined;
  const shopId = req.query.shopId ? Number(req.query.shopId) : undefined;
  return {
    from: fromRaw ? new Date(fromRaw) : undefined,
    to: toRaw ? new Date(toRaw) : undefined,
    shopId,
  };
}

function dateFilter(range: Range) {
  if (!range.from && !range.to) return undefined;
  return { gte: range.from, lte: range.to };
}

const num = (v: any) => Number(v ?? 0);

// ───────────────────────────── Sales ─────────────────────────────

// GET /reports/sales/by-product
export async function salesByProduct(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const range = parseRange(req);
  const grouped = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: {
      sale: { entityId, ...(range.shopId ? { shopId: range.shopId } : {}), soldAt: dateFilter(range) },
    },
    _sum: { quantity: true, lineTotal: true },
  });
  const products = await prisma.product.findMany({
    where: { id: { in: grouped.map((g) => g.productId) } },
    select: { id: true, name: true, code: true },
  });
  const map = new Map(products.map((p) => [p.id, p]));
  const rows = grouped
    .map((g) => ({
      productId: g.productId,
      product: map.get(g.productId)?.name ?? null,
      code: map.get(g.productId)?.code ?? null,
      quantity: num(g._sum.quantity),
      total: num(g._sum.lineTotal),
    }))
    .sort((a, b) => b.total - a.total);
  return ok(res, { range, rows, grandTotal: rows.reduce((s, r) => s + r.total, 0) });
}

// GET /reports/sales/by-category
export async function salesByCategory(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const range = parseRange(req);
  const items = await prisma.saleItem.findMany({
    where: {
      sale: { entityId, ...(range.shopId ? { shopId: range.shopId } : {}), soldAt: dateFilter(range) },
    },
    select: {
      quantity: true,
      lineTotal: true,
      product: { select: { category: { select: { id: true, name: true } } } },
    },
  });
  const agg = new Map<string, { categoryId: number | null; category: string; quantity: number; total: number }>();
  for (const it of items) {
    const cat = it.product.category;
    const key = cat ? String(cat.id) : 'none';
    const entry = agg.get(key) ?? {
      categoryId: cat?.id ?? null,
      category: cat?.name ?? 'Uncategorized',
      quantity: 0,
      total: 0,
    };
    entry.quantity += num(it.quantity);
    entry.total += num(it.lineTotal);
    agg.set(key, entry);
  }
  const rows = [...agg.values()].sort((a, b) => b.total - a.total);
  return ok(res, { range, rows, grandTotal: rows.reduce((s, r) => s + r.total, 0) });
}

// GET /reports/sales/by-customer
export async function salesByCustomer(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const range = parseRange(req);
  const grouped = await prisma.sale.groupBy({
    by: ['customerId'],
    where: { entityId, ...(range.shopId ? { shopId: range.shopId } : {}), soldAt: dateFilter(range) },
    _sum: { total: true },
    _count: { _all: true },
  });
  const customers = await prisma.customer.findMany({
    where: { id: { in: grouped.map((g) => g.customerId).filter((x): x is number => x != null) } },
    select: { id: true, name: true },
  });
  const map = new Map(customers.map((c) => [c.id, c.name]));
  const rows = grouped
    .map((g) => ({
      customerId: g.customerId,
      customer: g.customerId ? map.get(g.customerId) ?? null : 'Walk-in',
      invoices: g._count._all,
      total: num(g._sum.total),
    }))
    .sort((a, b) => b.total - a.total);
  return ok(res, { range, rows, grandTotal: rows.reduce((s, r) => s + r.total, 0) });
}

// ─────────────────────────── Purchases ───────────────────────────

// GET /reports/purchases/by-product
export async function purchasesByProduct(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const range = parseRange(req);
  const grouped = await prisma.purchaseItem.groupBy({
    by: ['productId'],
    where: {
      purchase: { entityId, ...(range.shopId ? { shopId: range.shopId } : {}), purchasedAt: dateFilter(range) },
    },
    _sum: { quantity: true, lineTotal: true },
  });
  const products = await prisma.product.findMany({
    where: { id: { in: grouped.map((g) => g.productId) } },
    select: { id: true, name: true, code: true },
  });
  const map = new Map(products.map((p) => [p.id, p]));
  const rows = grouped
    .map((g) => ({
      productId: g.productId,
      product: map.get(g.productId)?.name ?? null,
      code: map.get(g.productId)?.code ?? null,
      quantity: num(g._sum.quantity),
      total: num(g._sum.lineTotal),
    }))
    .sort((a, b) => b.total - a.total);
  return ok(res, { range, rows, grandTotal: rows.reduce((s, r) => s + r.total, 0) });
}

// GET /reports/purchases/by-category
export async function purchasesByCategory(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const range = parseRange(req);
  const items = await prisma.purchaseItem.findMany({
    where: {
      purchase: { entityId, ...(range.shopId ? { shopId: range.shopId } : {}), purchasedAt: dateFilter(range) },
    },
    select: {
      quantity: true,
      lineTotal: true,
      product: { select: { category: { select: { id: true, name: true } } } },
    },
  });
  const agg = new Map<string, { categoryId: number | null; category: string; quantity: number; total: number }>();
  for (const it of items) {
    const cat = it.product.category;
    const key = cat ? String(cat.id) : 'none';
    const entry = agg.get(key) ?? {
      categoryId: cat?.id ?? null,
      category: cat?.name ?? 'Uncategorized',
      quantity: 0,
      total: 0,
    };
    entry.quantity += num(it.quantity);
    entry.total += num(it.lineTotal);
    agg.set(key, entry);
  }
  const rows = [...agg.values()].sort((a, b) => b.total - a.total);
  return ok(res, { range, rows, grandTotal: rows.reduce((s, r) => s + r.total, 0) });
}

// GET /reports/purchases/by-supplier
export async function purchasesBySupplier(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const range = parseRange(req);
  const grouped = await prisma.purchase.groupBy({
    by: ['supplierId'],
    where: { entityId, ...(range.shopId ? { shopId: range.shopId } : {}), purchasedAt: dateFilter(range) },
    _sum: { total: true },
    _count: { _all: true },
  });
  const suppliers = await prisma.supplier.findMany({
    where: { id: { in: grouped.map((g) => g.supplierId).filter((x): x is number => x != null) } },
    select: { id: true, name: true },
  });
  const map = new Map(suppliers.map((s) => [s.id, s.name]));
  const rows = grouped
    .map((g) => ({
      supplierId: g.supplierId,
      supplier: g.supplierId ? map.get(g.supplierId) ?? null : 'Unknown',
      purchases: g._count._all,
      total: num(g._sum.total),
    }))
    .sort((a, b) => b.total - a.total);
  return ok(res, { range, rows, grandTotal: rows.reduce((s, r) => s + r.total, 0) });
}
