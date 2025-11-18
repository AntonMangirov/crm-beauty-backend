# Система обработки ошибок

## Обзор

Централизованная система обработки ошибок с типизированными классами ошибок для единообразной обработки ошибок во всем приложении.

## Архитектура

### Базовый класс AppError

```typescript
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
}
```

### Типы ошибок

#### HTTP ошибки

- `BadRequestError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `NotFoundError` (404)
- `ConflictError` (409)
- `ValidationError` (422)
- `TooManyRequestsError` (429)
- `InternalServerError` (500)
- `ServiceUnavailableError` (503)

#### Бизнес-логика ошибки

- `MasterNotFoundError` - Мастер не найден
- `MasterInactiveError` - Мастер неактивен
- `ServiceNotFoundError` - Услуга не найдена
- `ServiceInactiveError` - Услуга неактивна
- `TimeSlotConflictError` - Конфликт времени записи
- `AppointmentNotFoundError` - Запись не найдена
- `InvalidTimeSlotError` - Некорректное время
- `ClientNotFoundError` - Клиент не найден
- `ValidationFieldError` - Ошибка валидации поля
- `RequiredFieldError` - Отсутствует обязательное поле
- `InvalidCredentialsError` - Неверные учетные данные
- `TokenExpiredError` - Токен истек
- `NotificationFailedError` - Ошибка уведомления
- `QueueError` - Ошибка очереди

## Использование

### В контроллерах

```typescript
import {
  MasterNotFoundError,
  TimeSlotConflictError,
} from '../errors/BusinessErrors';

export async function getMaster(req: Request, res: Response) {
  const master = await prisma.user.findUnique({ where: { slug } });

  if (!master) {
    throw new MasterNotFoundError(slug);
  }

  // Остальная логика...
}
```

### В сервисах

```typescript
import { ServiceNotFoundError } from '../errors/BusinessErrors';

export async function getService(serviceId: string) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });

  if (!service) {
    throw new ServiceNotFoundError(serviceId);
  }

  return service;
}
```

### В middleware

```typescript
import { UnauthorizedError } from '../errors/AppError';

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization;

  if (!token) {
    throw new UnauthorizedError('Token is required');
  }

  // Проверка токена...
};
```

## Обработка ошибок

### Автоматическая обработка

Error-handler middleware автоматически обрабатывает все ошибки:

```typescript
// В app.ts
app.use(notFoundHandler);
app.use(errorHandler);
```

### Формат ответа

```json
{
  "error": "Master with slug 'test' not found",
  "code": "MASTER_NOT_FOUND",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "path": "/api/public/test"
}
```

### Обработка Prisma ошибок

- `P2002` → 409 Conflict (Unique constraint violation)
- `P2025` → 404 Not Found (Record not found)
- `P2003` → 400 Bad Request (Foreign key constraint violation)
- `P2014` → 400 Bad Request (Invalid ID)
- `P2021` → 404 Not Found (Table does not exist)
- `P2022` → 404 Not Found (Column does not exist)

### Обработка Zod ошибок

```json
{
  "error": "Validation error",
  "code": "ZOD_VALIDATION_ERROR",
  "details": {
    "issues": [
      {
        "field": "email",
        "message": "Invalid email",
        "code": "invalid_string"
      }
    ]
  }
}
```

## Логирование

Все ошибки автоматически логируются:

```typescript
console.error('Error occurred:', {
  message: error.message,
  stack: error.stack,
  url: req.url,
  method: req.method,
  timestamp: new Date().toISOString(),
});
```

## Лучшие практики

1. **Используйте типизированные ошибки** вместо прямых `res.status()`
2. **Пробрасывайте ошибки** в error-handler middleware
3. **Добавляйте контекст** в сообщения ошибок
4. **Используйте коды ошибок** для клиентской обработки
5. **Логируйте операционные ошибки** для мониторинга

## Примеры

### Создание записи с обработкой ошибок

```typescript
export async function bookAppointment(req: Request, res: Response) {
  try {
    const { masterId, serviceId, startAt } = req.body;

    // Проверка мастера
    const master = await prisma.user.findUnique({ where: { id: masterId } });
    if (!master) throw new MasterNotFoundError(masterId);

    // Проверка услуги
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service) throw new ServiceNotFoundError(serviceId);

    // Проверка конфликта времени
    const conflict = await checkTimeSlot(masterId, startAt);
    if (conflict) throw new TimeSlotConflictError(startAt, endAt);

    // Создание записи...
  } catch (error) {
    // Ошибка автоматически обработается error-handler middleware
    throw error;
  }
}
```

### Обработка в клиенте

```typescript
try {
  const response = await fetch('/api/public/master/book', {
    method: 'POST',
    body: JSON.stringify(bookingData),
  });

  if (!response.ok) {
    const error = await response.json();

    switch (error.code) {
      case 'MASTER_NOT_FOUND':
        showError('Мастер не найден');
        break;
      case 'TIME_SLOT_CONFLICT':
        showError('Время занято, выберите другое');
        break;
      default:
        showError('Произошла ошибка');
    }
  }
} catch (error) {
  showError('Ошибка сети');
}
```









