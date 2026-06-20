import { Request, Response } from 'express';
import { ok } from '../../utils/response';
import { resolveEntityId } from '../../utils/scope';
import { pullChanges } from './sync.service';
import { pushMutations } from './sync.push.service';

export async function pull(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const since = req.query.since as string | undefined;
  const result = await pullChanges(entityId, since);
  return ok(res, result);
}

export async function push(req: Request, res: Response) {
  const entityId = resolveEntityId(req);
  const createdById = req.user?.actor === 'SUB_USER' ? req.user.id : undefined;
  const { mutations } = req.body as { mutations: Parameters<typeof pushMutations>[1] };
  const results = await pushMutations(entityId, mutations ?? [], createdById);
  return ok(res, { results });
}
