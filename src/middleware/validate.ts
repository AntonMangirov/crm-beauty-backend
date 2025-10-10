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
      if (schemas.params)
        (req as any).params = schemas.params.parse(req.params);
      if (schemas.query) (req as any).query = schemas.query.parse(req.query);
      if (schemas.body) (req as any).body = schemas.body.parse(req.body);
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res
          .status(400)
          .json({ error: 'Validation failed', details: err.flatten() });
      }
      return res.status(400).json({ error: 'Validation failed' });
    }
  };
}
