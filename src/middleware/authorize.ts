import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { PermissionKey } from '../constants/permissions';

// Restrict a route to super admins only.
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(ApiError.unauthorized());
  if (!req.user.isSuperAdmin) return next(ApiError.forbidden('Super admin only'));
  return next();
}

// Restrict a route to entity users (sub users / main account), not super admin.
export function requireEntityUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.actor !== 'SUB_USER' || !req.user.entityId) {
    return next(ApiError.forbidden('Entity user only'));
  }
  return next();
}

// Require one of the given permissions. Main account / super admin bypass checks.
export function requirePermission(...required: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(ApiError.unauthorized());
    if (user.hasAllPermissions || user.isSuperAdmin) return next();
    const ok = required.some((p) => user.permissions.includes(p));
    if (!ok) return next(ApiError.forbidden('Insufficient permissions'));
    return next();
  };
}
