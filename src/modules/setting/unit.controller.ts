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
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.unit.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.unit.count({ where }),
  ]);
  return paginated(res, items, total, page, pageSize);
}

export async function create(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { name, shortName } = req.body;
  const unit = await prisma.unit.create({ data: { entityId, name, shortName } });
  return created(res, unit);
}

export async function update(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.unit.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('Unit not found');
  const { name, shortName, isActive } = req.body;
  const unit = await prisma.unit.update({ where: { id }, data: { name, shortName, isActive } });
  return ok(res, unit);
}

export async function remove(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.unit.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('Unit not found');
  await prisma.unit.delete({ where: { id } });
  return ok(res, { id }, 'Unit deleted');
}
