import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';
import { created, ok, paginated } from '../../utils/response';
import { getPageParams } from '../../utils/pagination';
import { resolveEntityId } from '../../utils/scope';

export async function list(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { skip, take, page, pageSize, search } = getPageParams(req);
  const where = {
    entityId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.customer.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.customer.count({ where }),
  ]);
  return paginated(res, items, total, page, pageSize);
}

export async function getOne(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const customer = await prisma.customer.findFirst({ where: { id: Number(req.params.id), entityId } });
  if (!customer) throw ApiError.notFound('Customer not found');
  return ok(res, customer);
}

export async function create(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { name, phone, email, address } = req.body;
  const customer = await prisma.customer.create({ data: { entityId, name, phone, email, address } });
  return created(res, customer);
}

export async function update(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.customer.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('Customer not found');
  const { name, phone, email, address, isActive } = req.body;
  const customer = await prisma.customer.update({
    where: { id },
    data: { name, phone, email, address, isActive },
  });
  return ok(res, customer);
}

export async function remove(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.customer.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('Customer not found');
  await prisma.customer.delete({ where: { id } });
  return ok(res, { id }, 'Customer deleted');
}
