import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/authorize';
import { PERMISSIONS } from '../../constants/permissions';
import type { PermissionKey } from '../../constants/permissions';
import * as ctrl from './stock.controller';

const router = Router();
router.use(authenticate);

const entry = z.object({
  shopId: z.number().int().positive(),
  productId: z.number().int().positive(),
  quantity: z.number().positive(),
  note: z.string().nullish(),
});

const stockReadPerms = [
  PERMISSIONS.STOCK_VIEW,
  PERMISSIONS.SALE_VIEW,
  PERMISSIONS.SALE_MANAGE,
] as PermissionKey[];

router.get('/', requirePermission(...stockReadPerms), asyncHandler(ctrl.listBalances));
router.get('/transactions', requirePermission(...stockReadPerms), asyncHandler(ctrl.listTransactions));

router.post('/damage', requirePermission(PERMISSIONS.STOCK_MANAGE), validate(z.object({ body: entry })), asyncHandler(ctrl.damage));
router.post('/loss', requirePermission(PERMISSIONS.STOCK_MANAGE), validate(z.object({ body: entry })), asyncHandler(ctrl.loss));

router.post(
  '/balance',
  requirePermission(PERMISSIONS.STOCK_MANAGE),
  validate(
    z.object({
      body: z.object({
        shopId: z.number().int().positive(),
        productId: z.number().int().positive(),
        quantity: z.number().nonnegative(),
        note: z.string().nullish(),
      }),
    }),
  ),
  asyncHandler(ctrl.balance),
);

router.post(
  '/transfer',
  requirePermission(PERMISSIONS.STOCK_TRANSFER),
  validate(
    z.object({
      body: z.object({
        fromShopId: z.number().int().positive(),
        toShopId: z.number().int().positive(),
        productId: z.number().int().positive(),
        quantity: z.number().positive(),
        note: z.string().nullish(),
      }),
    }),
  ),
  asyncHandler(ctrl.transfer),
);

export default router;
