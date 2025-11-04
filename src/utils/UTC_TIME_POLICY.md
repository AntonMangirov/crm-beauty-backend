# UTC Time Policy

## Обзор

Единая политика работы с временем в приложении: все время хранится в UTC в базе данных, фронтенд работает с ISO строками, автоматическое преобразование и валидация.

## Принципы

### 1. Хранение в БД

- **Все поля времени в БД хранятся в UTC**
- **Используется тип `DateTime` в Prisma**
- **Автоматическое преобразование при сохранении/чтении**

### 2. API взаимодействие

- **Фронтенд отправляет ISO строки** (например: `"2024-01-01T10:00:00.000Z"`)
- **API возвращает ISO строки** в UTC
- **Валидация формата времени на уровне API**

### 3. Внутренняя обработка

- **Все вычисления времени в UTC**
- **Преобразование в локальное время только для отображения**
- **Логирование времени в UTC**

## Архитектура

```
Frontend (ISO) → API (UTC) → Database (UTC) → API (UTC) → Frontend (ISO)
     ↓              ↓              ↓              ↓              ↓
Local Time    Validation    Storage      Processing    Display
```

## Компоненты

### 1. Time Utils (`src/utils/timeUtils.ts`)

#### Основные функции:

```typescript
// Преобразование ISO ↔ UTC
parseISOToUTC(isoString: string): Date
formatUTCToISO(date: Date): string

// Валидация времени
validateTimeRange(date: Date): boolean
isFutureTime(date: Date, bufferMinutes?: number): boolean
isValidBookingTime(date: Date, minAdvanceHours?: number, maxAdvanceDays?: number): boolean

// Работа с временем
addMinutesToUTC(date: Date, minutes: number): Date
getMinutesDifference(start: Date, end: Date): number
```

#### Примеры использования:

```typescript
import {
  parseISOToUTC,
  formatUTCToISO,
  addMinutesToUTC,
} from '../utils/timeUtils';

// Парсинг ISO строки
const startTime = parseISOToUTC('2024-01-01T10:00:00.000Z');

// Добавление времени
const endTime = addMinutesToUTC(startTime, 60);

// Форматирование для API
const isoString = formatUTCToISO(endTime);
```

### 2. Time Middleware (`src/middleware/timeMiddleware.ts`)

#### Валидация времени:

```typescript
// Автоматическая валидация времени в запросах
app.use('/api/public/:slug/book', validateTimeMiddleware);
```

#### Логирование времени:

```typescript
// Логирование временных операций
app.use(timeLoggingMiddleware);
```

#### Временные метки:

```typescript
// Добавление временных меток в ответы
app.use(addTimeStampsMiddleware);
```

### 3. Zod схемы

#### Валидация времени:

```typescript
export const BookingRequestSchema = z.object({
  startAt: z
    .string()
    .refine(isValidISOString, {
      message: 'startAt must be a valid ISO string',
    })
    .transform(isoString => new Date(isoString)),
  // ... другие поля
});
```

## Использование

### 1. В контроллерах

```typescript
import { addMinutesToUTC, formatUTCToISO } from '../utils/timeUtils';

export async function bookPublicSlot(req: Request, res: Response) {
  const { startAt } = req.body; // Уже Date объект из Zod

  // Вычисляем время окончания
  const endAt = addMinutesToUTC(startAt, service.durationMin);

  // Сохраняем в БД (автоматически в UTC)
  const appointment = await prisma.appointment.create({
    data: {
      startAt,
      endAt,
      // ... другие поля
    },
  });

  // Возвращаем ISO строки
  return res.json({
    startAt: formatUTCToISO(appointment.startAt),
    endAt: formatUTCToISO(appointment.endAt),
  });
}
```

### 2. В тестах

```typescript
import { parseISOToUTC, formatUTCToISO } from '../utils/timeUtils';

describe('UTC Time Policy', () => {
  it('should handle UTC time correctly', () => {
    const isoString = '2024-01-01T10:00:00.000Z';
    const date = parseISOToUTC(isoString);
    const formatted = formatUTCToISO(date);

    expect(formatted).toBe(isoString);
  });
});
```

## Валидация времени

### 1. Формат времени

- **Обязательно ISO 8601 формат**
- **Обязательно UTC (с суффиксом Z)**
- **Примеры: `"2024-01-01T10:00:00.000Z"`**

### 2. Временные ограничения

- **Минимум: 2 часа от текущего времени**
- **Максимум: 30 дней от текущего времени**
- **Рабочие часы: 9:00 - 21:00 UTC**
- **Рабочие дни: Понедельник - Пятница**

### 3. Валидация в middleware

```typescript
// Автоматическая валидация
app.use('/api/public/:slug/book', validateTimeMiddleware);
```

## Обработка ошибок

### 1. Неверный формат времени

```json
{
  "error": "Invalid time format",
  "code": "INVALID_TIME_FORMAT",
  "message": "startAt must be a valid ISO string",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "path": "/api/public/test-master/book"
}
```

### 2. Время в прошлом

```json
{
  "error": "Time in the past",
  "code": "TIME_IN_PAST",
  "message": "startAt must be in the future",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "path": "/api/public/test-master/book"
}
```

### 3. Неверный часовой пояс

```json
{
  "error": "Invalid timezone",
  "code": "INVALID_TIMEZONE",
  "message": "Unsupported timezone: Invalid/Timezone",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "path": "/api/public/test-master/book"
}
```

## Лучшие практики

### 1. Всегда используйте UTC

```typescript
// ✅ Правильно
const utcTime = new Date('2024-01-01T10:00:00.000Z');

// ❌ Неправильно
const localTime = new Date('2024-01-01T10:00:00');
```

### 2. Валидируйте время на входе

```typescript
// ✅ Используйте middleware
app.use('/api/public/:slug/book', validateTimeMiddleware);

// ✅ Используйте Zod схемы
const schema = z.object({
  startAt: z.string().refine(isValidISOString),
});
```

### 3. Логируйте время в UTC

```typescript
// ✅ Правильно
console.log(`Operation completed at ${new Date().toISOString()}`);

// ❌ Неправильно
console.log(`Operation completed at ${new Date().toLocaleString()}`);
```

### 4. Тестируйте с разными часовыми поясами

```typescript
// ✅ Тестируйте UTC время
const utcTime = new Date('2024-01-01T10:00:00.000Z');
expect(utcTime.toISOString()).toBe('2024-01-01T10:00:00.000Z');
```

## Миграция существующих данных

### 1. Проверка существующих данных

```sql
-- Проверяем что все время в UTC
SELECT start_at, end_at FROM appointments
WHERE start_at::text NOT LIKE '%Z';
```

### 2. Конвертация в UTC (если необходимо)

```sql
-- Конвертируем локальное время в UTC
UPDATE appointments
SET start_at = start_at AT TIME ZONE 'Europe/Moscow' AT TIME ZONE 'UTC',
    end_at = end_at AT TIME ZONE 'Europe/Moscow' AT TIME ZONE 'UTC';
```

## Мониторинг

### 1. Логирование временных операций

```typescript
// В development режиме
console.log(
  `[TIME] ${req.method} ${req.path} started at ${startTime.toISOString()}`
);
console.log(`[TIME] ${req.method} ${req.path} completed in ${duration}ms`);
```

### 2. Метрики времени

- **Время выполнения запросов**
- **Время обработки времени**
- **Ошибки валидации времени**

## Troubleshooting

### 1. Проблема: Время сохраняется в локальном часовом поясе

**Решение:** Убедитесь что все время преобразуется в UTC перед сохранением

### 2. Проблема: Фронтенд получает время в неправильном формате

**Решение:** Проверьте что API возвращает ISO строки в UTC

### 3. Проблема: Валидация времени не работает

**Решение:** Убедитесь что middleware времени подключен к правильным маршрутам

### 4. Проблема: Тесты падают из-за времени

**Решение:** Используйте фиксированное время в тестах или мокайте `Date.now()`

## Примеры

### 1. Создание записи

```typescript
// Фронтенд отправляет
const bookingData = {
  startAt: '2024-01-01T10:00:00.000Z',
  // ... другие поля
};

// API валидирует и преобразует
const startTime = parseISOToUTC(bookingData.startAt);
const endTime = addMinutesToUTC(startTime, 60);

// Сохраняет в БД в UTC
const appointment = await prisma.appointment.create({
  data: { startAt: startTime, endAt: endTime },
});

// Возвращает ISO строки
return {
  startAt: formatUTCToISO(appointment.startAt),
  endAt: formatUTCToISO(appointment.endAt),
};
```

### 2. Получение записей

```typescript
// Получаем из БД (в UTC)
const appointments = await prisma.appointment.findMany();

// Возвращаем ISO строки
return appointments.map(appointment => ({
  startAt: formatUTCToISO(appointment.startAt),
  endAt: formatUTCToISO(appointment.endAt),
}));
```

### 3. Валидация времени

```typescript
// Проверяем что время в будущем
if (!isFutureTime(startTime)) {
  throw new Error('Time must be in the future');
}

// Проверяем что время в допустимом диапазоне
if (!isValidBookingTime(startTime)) {
  throw new Error('Time must be between 2 hours and 30 days from now');
}
```

## Заключение

UTC политика времени обеспечивает:

- **Консистентность** - все время в одном формате
- **Надежность** - автоматическая валидация
- **Масштабируемость** - работа с разными часовыми поясами
- **Простота** - единый подход к работе с временем

Следуйте этим принципам для корректной работы с временем в приложении.






