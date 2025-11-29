import { ZodError, ZodObject, ZodTypeAny } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { logError } from '../utils/logger';

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
        if (schemas.params) {
          (req as any).params = schemas.params.parse(req.params);
        }
        if (schemas.query) {
          try {
            const validatedQuery = schemas.query.parse(req.query);
            (req as any).validatedQuery = validatedQuery;
            Object.assign(req.query, validatedQuery);
          } catch (err) {
            if (err instanceof ZodError) {
              logError('Ошибка валидации query параметров', err, {
                query: req.query,
                path: req.path,
              });
            }
            throw err;
          }
        }
      }

      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        logError('Ошибка валидации', err, {
          path: req.path,
          method: req.method,
          params: req.params,
          query: req.query,
        });

        const issues = err.issues;
        let errorMessage = 'Ошибка валидации данных';

        if (issues.length > 0) {
          const firstIssue = issues[0];
          if (firstIssue.path.length > 0) {
            const fieldName = firstIssue.path.join('.');
            errorMessage = `Ошибка в поле "${fieldName}": ${firstIssue.message}`;
          } else {
            errorMessage = firstIssue.message || errorMessage;
          }
        }

        const errorResponse = {
          error: 'Invalid request',
          message: errorMessage,
          details: err.flatten(),
        };
        return res.status(400).json(errorResponse);
      }
      logError('Неизвестная ошибка валидации', err);
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Ошибка валидации запроса',
      });
    }
  };
}
