import { Actor } from '../utils/jwt';

export interface AuthUser {
  id: number;
  actor: Actor;
  entityId?: number;
  isMain?: boolean;
  permissions: string[]; // resolved permission keys (empty for super admin / main = all)
  isSuperAdmin: boolean;
  hasAllPermissions: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
