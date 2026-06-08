import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import * as ctrl from './auth.controller';

const router = Router();

router.post(
  '/admin/login',
  validate(
    z.object({
      body: z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }),
    }),
  ),
  asyncHandler(ctrl.adminLogin),
);

router.post(
  '/login',
  validate(
    z.object({
      body: z.object({
        entityCode: z.string().min(1),
        username: z.string().min(1),
        password: z.string().min(1),
      }),
    }),
  ),
  asyncHandler(ctrl.userLogin),
);

router.post(
  '/refresh',
  validate(z.object({ body: z.object({ refreshToken: z.string().min(10) }) })),
  asyncHandler(ctrl.refresh),
);

router.get('/me', authenticate, asyncHandler(ctrl.me));

export default router;
