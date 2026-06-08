import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';

// Validates req.body / req.query / req.params against a zod schema.
// Schema shape: z.object({ body?, query?, params? }).
export const validate =
  (schema: AnyZodObject) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body) req.body = parsed.body;
      // query/params are read-only getters in Express 5; safe to assign in 4.
      if (parsed.query) Object.assign(req.query, parsed.query);
      if (parsed.params) Object.assign(req.params, parsed.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          ApiError.badRequest(
            'Validation failed',
            err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
          ),
        );
      }
      next(err);
    }
  };
