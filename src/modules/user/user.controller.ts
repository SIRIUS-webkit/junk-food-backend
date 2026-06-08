import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';
import { hashPassword } from '../../utils/password';
import { created, ok, paginated } from '../../utils/response';
import { getPageParams } from '../../utils/pagination';
import { resolveEntityId } from '../../utils/scope';
import { ALL_PERMISSIONS, PermissionKey } from '../../constants/permissions';

const userSelect = {
  id: true,
  username: true,
  name: true,
  description: true,
  phone: true,
  isMain: true,
  isActive: true,
  createdAt: true,
  permissions: { select: { permission: true } },
};

function shape(user: any) {
  return { ...user, permissions: user.permissions.map((p: any) => p.permission) };
}

// GET /users/permissions  — list assignable permission keys
export async function listPermissions(_req: Request, res: Response) {
  return ok(res, ALL_PERMISSIONS);
}

export async function list(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { skip, take, page, pageSize, search } = getPageParams(req);
  const where = {
    entityId,
    ...(search ? { username: { contains: search, mode: 'insensitive' as const } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.subUser.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: userSelect }),
    prisma.subUser.count({ where }),
  ]);
  return paginated(res, items.map(shape), total, page, pageSize);
}

export async function getOne(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const user = await prisma.subUser.findFirst({
    where: { id: Number(req.params.id), entityId },
    select: userSelect,
  });
  if (!user) throw ApiError.notFound('User not found');
  return ok(res, shape(user));
}

export async function create(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const { username, name, password, description, phone, permissions } = req.body as {
    username: string;
    name?: string;
    password: string;
    description?: string;
    phone?: string;
    permissions?: PermissionKey[];
  };
  const user = await prisma.subUser.create({
    data: {
      entityId,
      username,
      name,
      description,
      phone,
      passwordHash: await hashPassword(password),
      isMain: false,
      permissions: permissions?.length
        ? { create: permissions.map((p) => ({ permission: p })) }
        : undefined,
    },
    select: userSelect,
  });
  return created(res, shape(user));
}

export async function update(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.subUser.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('User not found');
  const { name, description, phone, isActive } = req.body;
  const user = await prisma.subUser.update({
    where: { id },
    data: { name, description, phone, isActive },
    select: userSelect,
  });
  return ok(res, shape(user));
}

// PUT /users/:id/password  { password }
export async function changePassword(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.subUser.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('User not found');
  await prisma.subUser.update({
    where: { id },
    data: { passwordHash: await hashPassword(req.body.password) },
  });
  return ok(res, { id }, 'Password updated');
}

// PUT /users/:id/permissions  { permissions: string[] }  — replaces the set
export async function setPermissions(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.subUser.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('User not found');
  if (existing.isMain) throw ApiError.badRequest('Main account already has all permissions');

  const permissions = req.body.permissions as PermissionKey[];
  await prisma.$transaction([
    prisma.userPermission.deleteMany({ where: { subUserId: id } }),
    prisma.userPermission.createMany({
      data: permissions.map((p) => ({ subUserId: id, permission: p })),
      skipDuplicates: true,
    }),
  ]);
  const user = await prisma.subUser.findUnique({ where: { id }, select: userSelect });
  return ok(res, shape(user));
}

export async function remove(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const id = Number(req.params.id);
  const existing = await prisma.subUser.findFirst({ where: { id, entityId } });
  if (!existing) throw ApiError.notFound('User not found');
  if (existing.isMain) throw ApiError.badRequest('Cannot delete the main account');
  await prisma.subUser.delete({ where: { id } });
  return ok(res, { id }, 'User deleted');
}
