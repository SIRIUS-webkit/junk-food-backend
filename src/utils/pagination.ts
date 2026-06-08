import { Request } from 'express';

export interface PageParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  search?: string;
}

export function getPageParams(req: Request): PageParams {
  const page = Math.max(parseInt((req.query.page as string) ?? '1', 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt((req.query.pageSize as string) ?? '20', 10) || 20, 1),
    100,
  );
  const search = (req.query.search as string | undefined)?.trim() || undefined;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize, search };
}
