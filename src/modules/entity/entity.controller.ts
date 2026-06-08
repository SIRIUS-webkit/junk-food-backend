import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';
import { hashPassword } from '../../utils/password';
import { created, ok, paginated } from '../../utils/response';
import { getPageParams } from '../../utils/pagination';

// GET /entities
export async function list(req: Request, res: Response) {
  const { skip, take, page, pageSize, search } = getPageParams(req);
  const where = search
    ? {
        OR: [
          { code: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
          { ownerName: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {};
  const [items, total] = await Promise.all([
    prisma.entity.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { shops: true, users: true } } },
    }),
    prisma.entity.count({ where }),
  ]);
  return paginated(res, items, total, page, pageSize);
}

// GET /entities/:id
export async function getOne(req: Request, res: Response) {
  const id = Number(req.params.id);
  const entity = await prisma.entity.findUnique({
    where: { id },
    include: { shops: true, _count: { select: { users: true } } },
  });
  if (!entity) throw ApiError.notFound('Entity not found');
  return ok(res, entity);
}

// POST /entities  — creates the entity and its main user account
export async function create(req: Request, res: Response) {
  const {
    code,
    name,
    description,
    address,
    phone1,
    phone2,
    ownerName,
    logo,
    email,
    mainUsername,
    mainPassword,
  } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    const entity = await tx.entity.create({
      data: { code, name, description, address, phone1, phone2, ownerName, logo, email },
    });
    const mainUser = await tx.subUser.create({
      data: {
        entityId: entity.id,
        username: mainUsername,
        name: ownerName ?? name,
        passwordHash: await hashPassword(mainPassword),
        isMain: true,
        phone: phone1,
      },
    });
    return { entity, mainUser: { id: mainUser.id, username: mainUser.username, isMain: true } };
  });

  return created(res, result);
}

// PUT /entities/:id
export async function update(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { code, name, description, address, phone1, phone2, ownerName, logo, email, isActive } =
    req.body;
  const entity = await prisma.entity.update({
    where: { id },
    data: { code, name, description, address, phone1, phone2, ownerName, logo, email, isActive },
  });
  return ok(res, entity);
}

// DELETE /entities/:id
export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);
  await prisma.entity.delete({ where: { id } });
  return ok(res, { id }, 'Entity deleted');
}
