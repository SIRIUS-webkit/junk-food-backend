import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/authorize';
import { PERMISSIONS } from '../../constants/permissions';
import * as ctrl from './sale.controller';

const router = Router();
router.use(authenticate);

const idParam = z.object({ params: z.object({ id: z.string().regex(/^\d+$/) }) });

router.get('/', requirePermission(PERMISSIONS.SALE_VIEW), asyncHandler(ctrl.list));
router.get('/:id', requirePermission(PERMISSIONS.SALE_VIEW), validate(idParam), asyncHandler(ctrl.getOne));

router.post(
  '/',
  requirePermission(PERMISSIONS.SALE_MANAGE),
  validate(
    z.object({
      body: z.object({
        shopId: z.number().int().positive(),
        customerId: z.number().int().positive().nullish(),
        invoiceNo: z.string().min(1),
        note: z.string().nullish(),
        soldAt: z.string().datetime().optional(),
        deductStock: z.boolean().optional(),
        items: z
          .array(
            z.object({
              productId: z.number().int().positive(),
              quantity: z.number().positive(),
              unitPrice: z.number().nonnegative(),
            }),
          )
          .min(1),
      }),
    }),
  ),
  asyncHandler(ctrl.create),
);

export default router;
