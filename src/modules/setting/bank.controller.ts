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
    prisma.bank.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
    prisma.bank.count({ where }),
  ]);
  return paginated(res, items, total, page, pageSize);
}

export async function create(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { name, accountName, accountNumber, branch } = req.body;
  const bank = await prisma.bank.create({
    data: { entityId, name, accountName, accountNumber, branch },
  });
  return created(res, bank);
}

export async function update(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.bank.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('Bank not found');
  const { name, accountName, accountNumber, branch, isActive } = req.body;
  const bank = await prisma.bank.update({
    where: { id },
    data: { name, accountName, accountNumber, branch, isActive },
  });
  return ok(res, bank);
}

export async function remove(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.bank.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('Bank not found');
  await prisma.bank.delete({ where: { id } });
  return ok(res, { id }, 'Bank deleted');
}
