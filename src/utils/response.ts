import { Response } from 'express';

export const ok = (res: Response, data: unknown, message = 'OK') =>
  res.status(200).json({ success: true, message, data });

export const created = (res: Response, data: unknown, message = 'Created') =>
  res.status(201).json({ success: true, message, data });

export const paginated = (
  res: Response,
  items: unknown[],
  total: number,
  page: number,
  pageSize: number,
) =>
  res.status(200).json({
    success: true,
    data: items,
    pagination: { total, page, pageSize, pages: Math.ceil(total / pageSize) },
  });
