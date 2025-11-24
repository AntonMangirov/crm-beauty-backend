import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { logError } from '../utils/logger';

interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
  path: string;
  serverTime?: string;
  timezone?: string;
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let code: string | undefined;
  let details: any = undefined;

  // Логируем ошибку в файл
  logError('Ошибка обработки запроса', error, {
    url: req.url,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Обработка наших типизированных ошибок
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
  }
  // Обработка Prisma ошибок
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = handlePrismaError(error);
    statusCode = prismaError.statusCode;
    message = prismaError.message;
    code = prismaError.code;
  }
  // Обработка Prisma валидационных ошибок
  else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Validation error';
    code = 'PRISMA_VALIDATION_ERROR';
    details = { originalMessage: error.message };
  }
  // Обработка Zod валидационных ошибок
  else if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error';
    code = 'ZOD_VALIDATION_ERROR';
    details = {
      issues: error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    };
  }
  // Обработка JSON parse ошибок
  else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    message = 'Invalid JSON';
    code = 'INVALID_JSON';
  }
  // Обработка других ошибок
  else {
    // В production не показываем детали внутренних ошибок
    if (process.env.NODE_ENV === 'production') {
      message = 'Something went wrong';
    } else {
      message = error.message;
      details = { stack: error.stack };
    }
  }

  const errorResponse: ErrorResponse = {
    error: message,
    code,
    details,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  res.status(statusCode).json(errorResponse);
};

// Обработка Prisma ошибок
function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  message: string;
  code: string;
} {
  switch (error.code) {
    case 'P2002':
      return {
        statusCode: 409,
        message: 'Unique constraint violation',
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
      };
    case 'P2025':
      return {
        statusCode: 404,
        message: 'Record not found',
        code: 'RECORD_NOT_FOUND',
      };
    case 'P2003':
      return {
        statusCode: 400,
        message: 'Foreign key constraint violation',
        code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
      };
    case 'P2014':
      return {
        statusCode: 400,
        message: 'Invalid ID provided',
        code: 'INVALID_ID',
      };
    case 'P2021':
      return {
        statusCode: 404,
        message: 'Table does not exist',
        code: 'TABLE_NOT_FOUND',
      };
    case 'P2022':
      return {
        statusCode: 404,
        message: 'Column does not exist',
        code: 'COLUMN_NOT_FOUND',
      };
    default:
      return {
        statusCode: 500,
        message: 'Database error',
        code: 'DATABASE_ERROR',
      };
  }
}

// Middleware для обработки необработанных ошибок
export const unhandledErrorHandler = (
  error: Error,
  req: Request,
  res: Response
): void => {
  logError('Необработанная ошибка', error);

  const errorResponse: ErrorResponse = {
    error: 'Internal Server Error',
    code: 'UNHANDLED_ERROR',
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  res.status(500).json(errorResponse);
};

// Middleware для обработки 404 ошибок
export const notFoundHandler = (req: Request, res: Response): void => {
  const now = new Date();
  const errorResponse: ErrorResponse = {
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    timestamp: now.toISOString(),
    path: req.path,
    serverTime: now.toISOString(),
    timezone: 'UTC',
  };

  res.status(404).json(errorResponse);
};
