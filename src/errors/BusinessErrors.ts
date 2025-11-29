import { AppError } from './AppError';

// Ошибки связанные с мастерами
export class MasterNotFoundError extends AppError {
  constructor(slug: string) {
    super(
      `Master with slug '${slug}' not found`,
      404,
      true,
      'MASTER_NOT_FOUND'
    );
  }
}

export class MasterInactiveError extends AppError {
  constructor(slug: string) {
    super(`Master '${slug}' is inactive`, 404, true, 'MASTER_INACTIVE');
  }
}

// Ошибки связанные с услугами
export class ServiceNotFoundError extends AppError {
  constructor(serviceId: string) {
    super(
      `Service with id '${serviceId}' not found`,
      404,
      true,
      'SERVICE_NOT_FOUND'
    );
  }
}

export class ServiceInactiveError extends AppError {
  constructor(serviceId: string) {
    super(`Service '${serviceId}' is inactive`, 400, true, 'SERVICE_INACTIVE');
  }
}

// Ошибки связанные с записями
export class TimeSlotConflictError extends AppError {
  constructor(startAt: string, endAt: string) {
    super(
      `Time slot conflict: ${startAt} - ${endAt} is not available`,
      409,
      true,
      'TIME_SLOT_CONFLICT'
    );
  }
}

export class AppointmentNotFoundError extends AppError {
  constructor(appointmentId: string) {
    super(
      `Appointment with id '${appointmentId}' not found`,
      404,
      true,
      'APPOINTMENT_NOT_FOUND'
    );
  }
}

export class InvalidTimeSlotError extends AppError {
  constructor(message: string) {
    super(`Invalid time slot: ${message}`, 400, true, 'INVALID_TIME_SLOT');
  }
}

// Ошибки связанные с клиентами
export class ClientNotFoundError extends AppError {
  constructor(clientId: string) {
    super(
      `Client with id '${clientId}' not found`,
      404,
      true,
      'CLIENT_NOT_FOUND'
    );
  }
}

// Ошибки валидации
export class ValidationFieldError extends AppError {
  constructor(field: string, message: string) {
    super(
      `Validation error for field '${field}': ${message}`,
      422,
      true,
      'VALIDATION_FIELD_ERROR'
    );
  }
}

export class RequiredFieldError extends AppError {
  constructor(field: string) {
    super(
      `Required field '${field}' is missing`,
      400,
      true,
      'REQUIRED_FIELD_ERROR'
    );
  }
}

// Ошибки аутентификации
export class InvalidCredentialsError extends AppError {
  constructor() {
    super('Invalid credentials', 401, true, 'INVALID_CREDENTIALS');
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super('Token has expired', 401, true, 'TOKEN_EXPIRED');
  }
}

// Ошибки уведомлений
export class NotificationFailedError extends AppError {
  constructor(appointmentId: string, reason: string) {
    super(
      `Notification failed for appointment '${appointmentId}': ${reason}`,
      500,
      true,
      'NOTIFICATION_FAILED'
    );
  }
}

// Ошибки очереди
export class QueueError extends AppError {
  constructor(queueName: string, reason: string) {
    super(`Queue '${queueName}' error: ${reason}`, 500, true, 'QUEUE_ERROR');
  }
}
