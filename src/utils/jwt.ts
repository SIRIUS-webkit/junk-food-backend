import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export type Actor = 'SUPER_ADMIN' | 'SUB_USER';

export interface TokenPayload {
  sub: number; // user id
  actor: Actor;
  entityId?: number; // present for sub users
  isMain?: boolean; // sub user is the entity main account
}

export const signAccessToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires,
  } as SignOptions);

export const signRefreshToken = (payload: TokenPayload): string =>
  jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpires,
  } as SignOptions);

export const verifyAccessToken = (token: string): TokenPayload =>
  jwt.verify(token, env.jwt.accessSecret) as unknown as TokenPayload;

export const verifyRefreshToken = (token: string): TokenPayload =>
  jwt.verify(token, env.jwt.refreshSecret) as unknown as TokenPayload;

export const issueTokens = (payload: TokenPayload) => ({
  accessToken: signAccessToken(payload),
  refreshToken: signRefreshToken(payload),
});
