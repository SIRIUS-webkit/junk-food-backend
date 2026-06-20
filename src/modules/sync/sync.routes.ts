import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import * as ctrl from './sync.controller';

const router = Router();
router.use(authenticate);

const syncEntity = z.enum([
  'shops',
  'categories',
  'products',
  'customers',
  'suppliers',
  'purchases',
  'sales',
]);

const mutationSchema = z.object({
  entity: syncEntity,
  op: z.enum(['create', 'update', 'delete']),
  syncId: z.string().uuid(),
  data: z.record(z.unknown()).optional(),
});

// Delta pull: all syncable changes in the caller's entity since `since` (ISO timestamp).
const pullQuery = z.object({
  query: z.object({
    since: z.string().datetime({ offset: true }).optional(),
  }),
});

const pushBody = z.object({
  body: z.object({
    mutations: z.array(mutationSchema).max(200),
  }),
});

router.get('/pull', validate(pullQuery), asyncHandler(ctrl.pull));
router.post('/push', validate(pushBody), asyncHandler(ctrl.push));

export default router;
