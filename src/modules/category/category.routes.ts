import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/authorize';
import { PERMISSIONS } from '../../constants/permissions';
import * as ctrl from './category.controller';

const router = Router();
router.use(authenticate);

const idParam = z.object({ params: z.object({ id: z.string().regex(/^\d+$/) }) });

router.get('/', requirePermission(PERMISSIONS.CATEGORY_VIEW), asyncHandler(ctrl.list));
router.get('/:id', requirePermission(PERMISSIONS.CATEGORY_VIEW), validate(idParam), asyncHandler(ctrl.getOne));

router.post(
  '/',
  requirePermission(PERMISSIONS.CATEGORY_MANAGE),
  validate(
    z.object({
      body: z.object({
        name: z.string().min(1),
        description: z.string().nullish(),
        parentId: z.number().int().positive().nullish(),
        isGroup: z.boolean().optional(),
        pricingType: z.enum(['weight', 'quantity']).optional(),
        pricePerUnit: z.number().nonnegative().optional(),
        unit: z.string().min(1).optional(),
      }),
    }),
  ),
  asyncHandler(ctrl.create),
);

router.put(
  '/:id',
  requirePermission(PERMISSIONS.CATEGORY_MANAGE),
  validate(
    z.object({
      params: z.object({ id: z.string().regex(/^\d+$/) }),
      body: z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullish(),
        pricingType: z.enum(['weight', 'quantity']).optional(),
        pricePerUnit: z.number().nonnegative().optional(),
        unit: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
      }),
    }),
  ),
  asyncHandler(ctrl.update),
);

router.delete('/:id', requirePermission(PERMISSIONS.CATEGORY_MANAGE), validate(idParam), asyncHandler(ctrl.remove));

export default router;
