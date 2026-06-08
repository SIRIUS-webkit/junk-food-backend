import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/authorize';
import { PERMISSIONS } from '../../constants/permissions';
import * as ctrl from './product.controller';

const router = Router();
router.use(authenticate);

const idParam = z.object({ params: z.object({ id: z.string().regex(/^\d+$/) }) });

const createBody = z.object({
  code: z.string().nullish(),
  name: z.string().min(1),
  description: z.string().nullish(),
  categoryId: z.number().int().positive().nullish(),
  unitId: z.number().int().positive().nullish(),
  purchasePrice: z.number().nonnegative().optional(),
  salePrice: z.number().nonnegative().optional(),
});

router.get('/', requirePermission(PERMISSIONS.PRODUCT_VIEW), asyncHandler(ctrl.list));
router.get('/:id', requirePermission(PERMISSIONS.PRODUCT_VIEW), validate(idParam), asyncHandler(ctrl.getOne));

router.post(
  '/',
  requirePermission(PERMISSIONS.PRODUCT_MANAGE),
  validate(z.object({ body: createBody })),
  asyncHandler(ctrl.create),
);

router.put(
  '/:id',
  requirePermission(PERMISSIONS.PRODUCT_MANAGE),
  validate(
    z.object({
      params: z.object({ id: z.string().regex(/^\d+$/) }),
      body: createBody.partial().extend({ isActive: z.boolean().optional() }),
    }),
  ),
  asyncHandler(ctrl.update),
);

router.delete('/:id', requirePermission(PERMISSIONS.PRODUCT_MANAGE), validate(idParam), asyncHandler(ctrl.remove));

export default router;
