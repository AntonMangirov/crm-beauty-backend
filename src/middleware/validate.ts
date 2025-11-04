import { ZodError, ZodObject, ZodTypeAny } from 'zod';
import { Request, Response, NextFunction } from 'express';

type Schemas = {
  body?: ZodObject<any> | ZodTypeAny;
  params?: ZodObject<any> | ZodTypeAny;
  query?: ZodObject<any> | ZodTypeAny;
};

export function validate(schemas: Schemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        const sanitizedBody = { ...req.body };
        if (sanitizedBody.startAt instanceof Date) {
          sanitizedBody.startAt = sanitizedBody.startAt.toISOString();
        }

        (req as any).body = schemas.body.parse(sanitizedBody);
      } else {
        if (schemas.params)
          (req as any).params = schemas.params.parse(req.params);
        if (schemas.query) (req as any).query = schemas.query.parse(req.query);
      }

      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errorResponse = {
          error: 'Invalid request',
          details: err.flatten(),
          message: 'Проверьте правильность заполнения полей',
        };
        return res.status(400).json(errorResponse);
      }
      return res.status(400).json({ error: 'Validation failed' });
    }
  };
}
