import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { requireSuperAdmin } from '../../middleware/authorize';
import * as ctrl from './entity.controller';

const router = Router();

// All entity management is super-admin only.
router.use(authenticate, requireSuperAdmin);

const idParam = z.object({ params: z.object({ id: z.string().regex(/^\d+$/) }) });

router.get('/', asyncHandler(ctrl.list));
router.get('/:id', validate(idParam), asyncHandler(ctrl.getOne));

router.post(
  '/',
  validate(
    z.object({
      body: z.object({
        code: z.string().min(1).max(32),
        name: z.string().min(1),
        description: z.string().optional(),
        address: z.string().optional(),
        phone1: z.string().optional(),
        phone2: z.string().optional(),
        ownerName: z.string().optional(),
        logo: z.string().optional(),
        email: z.string().email().optional(),
        mainUsername: z.string().min(1),
        mainPassword: z.string().min(6),
      }),
    }),
  ),
  asyncHandler(ctrl.create),
);

router.put(
  '/:id',
  validate(
    z.object({
      params: z.object({ id: z.string().regex(/^\d+$/) }),
      body: z.object({
        code: z.string().min(1).max(32).optional(),
        name: z.string().min(1).optional(),
        description: z.string().nullish(),
        address: z.string().nullish(),
        phone1: z.string().nullish(),
        phone2: z.string().nullish(),
        ownerName: z.string().nullish(),
        logo: z.string().nullish(),
        email: z.string().email().nullish(),
        isActive: z.boolean().optional(),
      }),
    }),
  ),
  asyncHandler(ctrl.update),
);

router.delete('/:id', validate(idParam), asyncHandler(ctrl.remove));

export default router;
