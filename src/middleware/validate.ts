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
      // Логируем входящий запрос для отладки
      if (process.env.NODE_ENV === 'development') {
        console.log('[VALIDATE] Incoming request:', {
          path: req.path,
          method: req.method,
          params: req.params,
          query: req.query,
        });
      }

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
            // Валидируем query, но не перезаписываем req.query (он только для чтения)
            // Вместо этого сохраняем валидированные данные в req.validatedQuery
            const validatedQuery = schemas.query.parse(req.query);
            (req as any).validatedQuery = validatedQuery;
            // Также обновляем req.query через Object.assign для совместимости
            Object.assign(req.query, validatedQuery);
          } catch (err) {
            if (err instanceof ZodError) {
              console.error('[VALIDATE] Query validation error:', {
                query: req.query,
                issues: err.issues,
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
        console.error('[VALIDATE] Validation error:', {
          path: req.path,
          method: req.method,
          issues: err.issues,
          params: req.params,
          query: req.query,
          body: req.body,
        });

        // Формируем понятные сообщения об ошибках на русском
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
      console.error('[VALIDATE] Unknown validation error:', err);
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Ошибка валидации запроса',
      });
    }
  };
}
