import { Request } from 'express';
import { ApiError } from './ApiError';

// Resolve which entity a request operates on.
// - Sub users are locked to their own entity.
// - Super admins must specify ?entityId= (query) or entityId in body/params.
export function resolveEntityId(req: Request): number {
  const user = req.user;
  if (!user) throw ApiError.unauthorized();

  if (user.actor === 'SUB_USER') {
    if (!user.entityId) throw ApiError.forbidden('User has no entity');
    return user.entityId;
  }

  // Super admin
  const raw =
    (req.query.entityId as string | undefined) ??
    (req.body?.entityId as string | number | undefined) ??
    (req.params.entityId as string | undefined);
  const id = typeof raw === 'number' ? raw : raw ? parseInt(raw, 10) : NaN;
  if (!id || Number.isNaN(id)) {
    throw ApiError.badRequest('Super admin must specify entityId');
  }
  return id;
}
