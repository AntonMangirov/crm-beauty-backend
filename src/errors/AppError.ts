export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string
  ) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    // Сохраняем стек вызовов
    Error.captureStackTrace(this, this.constructor);
  }
}

// Базовые типы ошибок
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', code?: string) {
    super(message, 400, true, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', code?: string) {
    super(message, 401, true, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', code?: string) {
    super(message, 403, true, code);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found', code?: string) {
    super(message, 404, true, code);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict', code?: string) {
    super(message, 409, true, code);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation Error', code?: string) {
    super(message, 422, true, code);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too Many Requests', code?: string) {
    super(message, 429, true, code);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error', code?: string) {
    super(message, 500, true, code);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service Unavailable', code?: string) {
    super(message, 503, true, code);
  }
}
