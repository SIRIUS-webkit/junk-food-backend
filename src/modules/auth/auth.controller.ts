import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../utils/ApiError';
import { verifyPassword } from '../../utils/password';
import { issueTokens, TokenPayload, verifyRefreshToken } from '../../utils/jwt';
import { ok } from '../../utils/response';

// POST /auth/admin/login  { email, password }
export async function adminLogin(req: Request, res: Response) {
  const { email, password } = req.body;
  const admin = await prisma.superAdmin.findUnique({ where: { email } });
  if (!admin || !admin.isActive) throw ApiError.unauthorized('Invalid credentials');
  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) throw ApiError.unauthorized('Invalid credentials');

  const payload: TokenPayload = { sub: admin.id, actor: 'SUPER_ADMIN' };
  const tokens = issueTokens(payload);
  return ok(res, {
    ...tokens,
    user: { id: admin.id, name: admin.name, email: admin.email, role: 'SUPER_ADMIN' },
  });
}

// POST /auth/login  { entityCode, username, password }
export async function userLogin(req: Request, res: Response) {
  const { entityCode, username, password } = req.body;
  const entity = await prisma.entity.findUnique({ where: { code: entityCode } });
  if (!entity || !entity.isActive) throw ApiError.unauthorized('Invalid credentials');

  const user = await prisma.subUser.findUnique({
    where: { entityId_username: { entityId: entity.id, username } },
  });
  if (!user || !user.isActive) throw ApiError.unauthorized('Invalid credentials');
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Invalid credentials');

  const payload: TokenPayload = {
    sub: user.id,
    actor: 'SUB_USER',
    entityId: user.entityId,
    isMain: user.isMain,
  };
  const tokens = issueTokens(payload);
  return ok(res, {
    ...tokens,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      isMain: user.isMain,
      entityId: user.entityId,
      entityCode: entity.code,
      role: 'SUB_USER',
    },
  });
}

// POST /auth/refresh  { refreshToken }
export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body;
  let payload: TokenPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  // Re-validate the account still exists / active.
  if (payload.actor === 'SUPER_ADMIN') {
    const admin = await prisma.superAdmin.findUnique({ where: { id: payload.sub } });
    if (!admin || !admin.isActive) throw ApiError.unauthorized('Account not found');
  } else {
    const user = await prisma.subUser.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw ApiError.unauthorized('Account not found');
  }

  const next: TokenPayload = {
    sub: payload.sub,
    actor: payload.actor,
    entityId: payload.entityId,
    isMain: payload.isMain,
  };
  return ok(res, issueTokens(next));
}

// GET /auth/me
export async function me(req: Request, res: Response) {
  const user = req.user!;
  if (user.isSuperAdmin) {
    const admin = await prisma.superAdmin.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, email: true, phone: true },
    });
    return ok(res, { ...admin, role: 'SUPER_ADMIN' });
  }
  const subUser = await prisma.subUser.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      username: true,
      name: true,
      isMain: true,
      entityId: true,
      permissions: { select: { permission: true } },
    },
  });
  return ok(res, {
    ...subUser,
    role: 'SUB_USER',
    permissions: subUser?.permissions.map((p) => p.permission) ?? [],
  });
}
