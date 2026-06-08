import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/ApiError';
import { verifyAccessToken } from '../utils/jwt';
import { AuthUser } from '../types/express';

// Validates the Bearer access token and attaches req.user.
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing access token');
    }
    const token = header.slice('Bearer '.length).trim();

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    if (payload.actor === 'SUPER_ADMIN') {
      const admin = await prisma.superAdmin.findUnique({ where: { id: payload.sub } });
      if (!admin || !admin.isActive) throw ApiError.unauthorized('Account not found');
      const user: AuthUser = {
        id: admin.id,
        actor: 'SUPER_ADMIN',
        permissions: [],
        isSuperAdmin: true,
        hasAllPermissions: true,
      };
      req.user = user;
      return next();
    }

    // Sub user
    const subUser = await prisma.subUser.findUnique({
      where: { id: payload.sub },
      include: { permissions: true },
    });
    if (!subUser || !subUser.isActive) throw ApiError.unauthorized('Account not found');

    const user: AuthUser = {
      id: subUser.id,
      actor: 'SUB_USER',
      entityId: subUser.entityId,
      isMain: subUser.isMain,
      permissions: subUser.permissions.map((p) => p.permission),
      isSuperAdmin: false,
      hasAllPermissions: subUser.isMain, // main account = all permissions
    };
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}
