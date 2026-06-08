import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/authorize';
import { PERMISSIONS } from '../../constants/permissions';
import * as ctrl from './customer.controller';

const router = Router();
router.use(authenticate);

const idParam = z.object({ params: z.object({ id: z.string().regex(/^\d+$/) }) });
const body = z.object({
  name: z.string().min(1),
  phone: z.string().nullish(),
  email: z.string().email().nullish(),
  address: z.string().nullish(),
});

router.get('/', requirePermission(PERMISSIONS.CUSTOMER_VIEW), asyncHandler(ctrl.list));
router.get('/:id', requirePermission(PERMISSIONS.CUSTOMER_VIEW), validate(idParam), asyncHandler(ctrl.getOne));
router.post('/', requirePermission(PERMISSIONS.CUSTOMER_MANAGE), validate(z.object({ body })), asyncHandler(ctrl.create));
router.put(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMER_MANAGE),
  validate(
    z.object({
      params: z.object({ id: z.string().regex(/^\d+$/) }),
      body: body.partial().extend({ isActive: z.boolean().optional() }),
    }),
  ),
  asyncHandler(ctrl.update),
);
router.delete('/:id', requirePermission(PERMISSIONS.CUSTOMER_MANAGE), validate(idParam), asyncHandler(ctrl.remove));

export default router;
