import { Prisma } from '@prisma/client';

/** Recursively convert Prisma types to JSON-safe values for sync pull/push responses. */
export function serializeForJson<T>(value: T): T {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber() as T;
  }
  if (value instanceof Date) {
    return value.toISOString() as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeForJson(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, serializeForJson(v)]),
    ) as T;
  }
  return value;
}
