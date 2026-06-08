import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/authorize';
import { PERMISSIONS } from '../../constants/permissions';
import * as ctrl from './shop.controller';

const router = Router();
router.use(authenticate);

const idParam = z.object({ params: z.object({ id: z.string().regex(/^\d+$/) }) });

const bodySchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1),
  description: z.string().nullish(),
  address: z.string().nullish(),
  phone1: z.string().nullish(),
  phone2: z.string().nullish(),
  inchargeName: z.string().nullish(),
});

router.get('/', requirePermission(PERMISSIONS.SHOP_VIEW), asyncHandler(ctrl.list));
router.get('/:id', requirePermission(PERMISSIONS.SHOP_VIEW), validate(idParam), asyncHandler(ctrl.getOne));

router.post(
  '/',
  requirePermission(PERMISSIONS.SHOP_MANAGE),
  validate(z.object({ body: bodySchema })),
  asyncHandler(ctrl.create),
);

router.put(
  '/:id',
  requirePermission(PERMISSIONS.SHOP_MANAGE),
  validate(
    z.object({
      params: z.object({ id: z.string().regex(/^\d+$/) }),
      body: bodySchema.partial().extend({ isActive: z.boolean().optional() }),
    }),
  ),
  asyncHandler(ctrl.update),
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.SHOP_MANAGE),
  validate(idParam),
  asyncHandler(ctrl.remove),
);

export default router;
