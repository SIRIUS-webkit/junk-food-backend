import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/authorize';
import { ALL_PERMISSIONS, PERMISSIONS } from '../../constants/permissions';
import * as ctrl from './user.controller';

const router = Router();
router.use(authenticate);

const idParam = z.object({ params: z.object({ id: z.string().regex(/^\d+$/) }) });
const permissionEnum = z.enum(ALL_PERMISSIONS as [string, ...string[]]);

router.get('/permissions', requirePermission(PERMISSIONS.USER_VIEW), asyncHandler(ctrl.listPermissions));
router.get('/', requirePermission(PERMISSIONS.USER_VIEW), asyncHandler(ctrl.list));
router.get('/:id', requirePermission(PERMISSIONS.USER_VIEW), validate(idParam), asyncHandler(ctrl.getOne));

router.post(
  '/',
  requirePermission(PERMISSIONS.USER_MANAGE),
  validate(
    z.object({
      body: z.object({
        username: z.string().min(1),
        name: z.string().optional(),
        password: z.string().min(6),
        description: z.string().optional(),
        phone: z.string().optional(),
        permissions: z.array(permissionEnum).optional(),
      }),
    }),
  ),
  asyncHandler(ctrl.create),
);

router.put(
  '/:id',
  requirePermission(PERMISSIONS.USER_MANAGE),
  validate(
    z.object({
      params: z.object({ id: z.string().regex(/^\d+$/) }),
      body: z.object({
        name: z.string().nullish(),
        description: z.string().nullish(),
        phone: z.string().nullish(),
        isActive: z.boolean().optional(),
      }),
    }),
  ),
  asyncHandler(ctrl.update),
);

router.put(
  '/:id/password',
  requirePermission(PERMISSIONS.USER_MANAGE),
  validate(
    z.object({
      params: z.object({ id: z.string().regex(/^\d+$/) }),
      body: z.object({ password: z.string().min(6) }),
    }),
  ),
  asyncHandler(ctrl.changePassword),
);

router.put(
  '/:id/permissions',
  requirePermission(PERMISSIONS.USER_MANAGE),
  validate(
    z.object({
      params: z.object({ id: z.string().regex(/^\d+$/) }),
      body: z.object({ permissions: z.array(permissionEnum) }),
    }),
  ),
  asyncHandler(ctrl.setPermissions),
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.USER_MANAGE),
  validate(idParam),
  asyncHandler(ctrl.remove),
);

export default router;
