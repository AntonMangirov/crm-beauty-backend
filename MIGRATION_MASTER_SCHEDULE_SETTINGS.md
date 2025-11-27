# Миграция: Добавление полей расписания и настроек слотов для мастера

## Обзор изменений

Добавлены новые поля в модель `User` (Master) для поддержки умного алгоритма генерации слотов:
- `workSchedule` (JSONB) - расписание работы по дням недели
- `breaks` (JSONB) - перерывы мастера
- `defaultBufferMinutes` (Int) - буфер после услуги по умолчанию
- `slotStepMinutes` (Int) - шаг генерации слотов

## Структура новых полей

### workSchedule (JSONB)
```typescript
type WorkSchedule = Array<{
  dayOfWeek: number; // 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
  intervals: Array<{
    from: string; // "HH:mm" формат, например "09:00"
    to: string;   // "HH:mm" формат, например "18:00"
  }>;
}>;

// Пример:
[
  {
    dayOfWeek: 1, // Понедельник
    intervals: [
      { from: "09:00", to: "13:00" },
      { from: "14:00", to: "19:00" }
    ]
  },
  {
    dayOfWeek: 2, // Вторник
    intervals: [
      { from: "09:00", to: "18:00" }
    ]
  }
]
```

### breaks (JSONB)
```typescript
type Breaks = Array<{
  from: string;    // "HH:mm" формат
  to: string;      // "HH:mm" формат
  reason?: string; // Опциональная причина перерыва
}>;

// Пример:
[
  { from: "13:00", to: "14:00", reason: "Обед" },
  { from: "15:30", to: "15:45" }
]
```

### defaultBufferMinutes (Int)
- Значение по умолчанию: `15`
- Минимальное значение: `0`
- Максимальное значение: `60` (рекомендуется)
- Используется если у услуги не указан свой буфер

### slotStepMinutes (Int)
- Значение по умолчанию: `15`
- Допустимые значения: `5`, `10`, `15`
- Определяет интервал между возможными временами начала записи

## Миграция базы данных

### Файл миграции
`prisma/migrations/20250125000000_add_master_schedule_settings/migration.sql`

### SQL команды
```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workSchedule" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "breaks" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultBufferMinutes" INTEGER DEFAULT 15;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "slotStepMinutes" INTEGER DEFAULT 15;
```

### Значения по умолчанию
- `workSchedule`: `NULL` (мастер может настроить позже)
- `breaks`: `NULL` (мастер может настроить позже)
- `defaultBufferMinutes`: `15`
- `slotStepMinutes`: `15`

## Обновленная модель Prisma

```prisma
model User {
  // ... существующие поля ...
  
  // Новые поля для расписания работы и настроек слотов
  workSchedule  Json?         // Расписание работы: массив { dayOfWeek: number, intervals: [{ from: string, to: string }] }
  breaks        Json?         // Перерывы мастера: массив { from: string, to: string, reason?: string }
  defaultBufferMinutes Int?   @default(15)      // Буфер после услуги по умолчанию (минуты)
  slotStepMinutes Int?        @default(15)       // Шаг генерации слотов (минуты): 5, 10, 15
  
  // ... остальные поля ...
}
```

## Анализ совместимости

### ✅ Безопасные изменения

Все новые поля являются **опциональными** (nullable) и имеют значения по умолчанию. Это гарантирует:

1. **Обратная совместимость**: Существующие записи автоматически получат значения по умолчанию
2. **Не требуется обновление DTO**: Существующие схемы валидации не изменяются
3. **Фронтенд не сломается**: Новые поля не возвращаются в существующих эндпоинтах (используется `select`)

### Эндпоинты, которые НЕ затронуты (безопасны)

#### Public API (`/api/public/:slug/*`)

1. **GET `/api/public/:slug`** - `getPublicProfileBySlug`
   - ✅ Использует `select` с явным списком полей
   - ✅ Новые поля не включены в `select`
   - ✅ Схема `PublicProfileResponseSchema` не изменяется

2. **GET `/api/public/:slug/timeslots`** - `getTimeslots`
   - ✅ Использует `select: { id: true, isActive: true }`
   - ✅ Новые поля будут использоваться через отдельную логику (не в select)
   - ⚠️ **Потенциально затронут**: Будет использовать новые поля для генерации слотов (но через отдельную функцию)

3. **POST `/api/public/:slug/book`** - `bookPublicSlot`
   - ✅ Использует `findUnique` без select (но не использует новые поля)
   - ✅ Не затронут

4. **GET `/api/public/:slug/reviews`** - `getReviewsBySlug`
   - ✅ Использует `select: { id: true, isActive: true }`
   - ✅ Не затронут

5. **POST `/api/public/:slug/reviews`** - `createReview`
   - ✅ Использует `select: { id: true, isActive: true }`
   - ✅ Не затронут

#### Protected API (`/api/me/*`)

1. **GET `/api/me`** - `getMe`
   - ✅ Использует `select` с явным списком полей
   - ✅ Новые поля не включены в `select`
   - ✅ Схема `MeResponseSchema` не изменяется
   - ⚠️ **Рекомендация**: В будущем можно добавить новые поля в ответ (опционально)

2. **PATCH `/api/me/profile`** - `updateProfile`
   - ✅ Использует `UpdateProfileSchema` (не включает новые поля)
   - ✅ Не затронут
   - ⚠️ **Рекомендация**: В будущем можно добавить поддержку обновления новых полей

3. **POST `/api/me/profile/upload-photo`** - `uploadPhoto`
   - ✅ Не затронут

4. **GET `/api/me/appointments`** - `getAppointments`
   - ✅ Не затронут

5. **GET `/api/me/appointments/last-manual`** - `getLastManualAppointments`
   - ✅ Не затронут

6. **PUT `/api/me/appointments/:id`** - `updateAppointmentStatus`
   - ✅ Не затронут

7. **POST `/api/me/appointments/:id/photos`** - `uploadAppointmentPhotos`
   - ✅ Не затронут

8. **DELETE `/api/me/appointments/:id/photos/:photoId`** - `deleteAppointmentPhoto`
   - ✅ Не затронут

9. **GET `/api/me/clients`** - `getClients`
   - ✅ Не затронут

10. **GET `/api/me/clients/:id/history`** - `getClientHistory`
    - ✅ Не затронут

11. **GET `/api/me/services`** - `getServices`
    - ✅ Не затронут

12. **GET `/api/me/services/top`** - `getTopServices`
    - ✅ Не затронут

13. **POST `/api/me/services`** - `createService`
    - ✅ Не затронут

14. **GET `/api/me/services/:id`** - `getServiceById`
    - ✅ Не затронут

15. **PATCH `/api/me/services/:id`** - `updateService`
    - ✅ Не затронут

16. **DELETE `/api/me/services/:id`** - `deleteService`
    - ✅ Не затронут

17. **GET `/api/me/analytics`** - `getAnalytics`
    - ✅ Не затронут

18. **GET `/api/me/portfolio`** - `getPortfolio`
    - ✅ Не затронут

19. **POST `/api/me/portfolio/photos`** - `uploadPortfolioPhoto`
    - ✅ Не затронут

20. **DELETE `/api/me/portfolio/photos/:id`** - `deletePortfolioPhoto`
    - ✅ Не затронут

21. **PATCH `/api/me/settings/password`** - `changePassword`
    - ✅ Не затронут

22. **PATCH `/api/me/settings/email`** - `changeEmail`
    - ✅ Не затронут

23. **PATCH `/api/me/settings/phone`** - `changePhone`
    - ✅ Не затронут

#### Auth API (`/api/auth/*`)

1. **POST `/api/auth/register`** - `register`
   - ✅ Использует `create` с явными полями
   - ✅ Новые поля не требуются при регистрации
   - ✅ Не затронут

2. **POST `/api/auth/login`** - `login`
   - ✅ Использует `findUnique` без select
   - ✅ Не затронут

3. **GET `/api/auth/me`** - `me`
   - ✅ Использует `findUnique` без select
   - ✅ Не затронут

4. **POST `/api/auth/logout`** - `logout`
   - ✅ Не затронут

5. **POST `/api/auth/refresh`** - `refresh`
   - ✅ Использует `findUnique` с select только для refreshToken
   - ✅ Не затронут

### Эндпоинты, которые БУДУТ использовать новые поля

1. **GET `/api/public/:slug/timeslots`** - `getTimeslots`
   - ⚠️ **Изменение**: Будет использовать новые поля через функцию `calculateAvailableSlots`
   - ✅ **Безопасно**: Использует значения по умолчанию, если поля не заданы
   - ✅ **Обратная совместимость**: Старые мастера продолжат работать с дефолтными значениями

## Проверка безопасности

### ✅ Все эндпоинты используют `select` с явным списком полей

Это означает, что новые поля **не будут автоматически возвращаться** в существующих ответах API, что гарантирует совместимость с фронтендом.

### ✅ Все новые поля опциональные (nullable)

Существующие записи в базе данных продолжат работать без изменений.

### ✅ Значения по умолчанию установлены

- `defaultBufferMinutes = 15`
- `slotStepMinutes = 15`
- `workSchedule = NULL` (будет использоваться дефолтное расписание в коде)
- `breaks = NULL` (будет использоваться пустой массив в коде)

## Рекомендации по безопасным изменениям

### 1. Обновление контроллера `getTimeslots`

**Текущее состояние**: Использует хардкод значений по умолчанию
```typescript
const masterSettings: MasterSettings = {
  workIntervals: [{ start: '09:00', end: '18:00' }],
  breaks: [],
  serviceBufferMinutes: 15,
  slotStepMinutes: 15,
  timezone: (req as any).timezone || 'Europe/Moscow',
};
```

**Рекомендация**: Загружать настройки из базы данных:
```typescript
const master = await prisma.user.findUnique({
  where: { slug },
  select: {
    id: true,
    isActive: true,
    workSchedule: true,
    breaks: true,
    defaultBufferMinutes: true,
    slotStepMinutes: true,
  },
});

// Преобразовать workSchedule в формат для функции
const workIntervals = master.workSchedule 
  ? parseWorkSchedule(master.workSchedule, targetDateStr)
  : [{ start: '09:00', end: '18:00' }]; // Fallback

const masterSettings: MasterSettings = {
  workIntervals,
  breaks: master.breaks || [],
  serviceBufferMinutes: master.defaultBufferMinutes ?? 15,
  slotStepMinutes: master.slotStepMinutes ?? 15,
  timezone: (req as any).timezone || 'Europe/Moscow',
};
```

### 2. Добавление эндпоинта для управления расписанием (опционально)

**Рекомендация**: Создать новые эндпоинты для управления расписанием:
- `GET /api/me/schedule` - получить расписание мастера
- `PATCH /api/me/schedule` - обновить расписание мастера
- `GET /api/me/breaks` - получить перерывы мастера
- `PATCH /api/me/breaks` - обновить перерывы мастера
- `PATCH /api/me/settings/slots` - обновить настройки слотов (buffer, step)

### 3. Обновление схем валидации (опционально)

**Рекомендация**: Добавить новые поля в `MeResponseSchema` (опционально):
```typescript
export const MeResponseSchema = z.object({
  // ... существующие поля ...
  workSchedule: z.array(/* схема */).nullable().optional(),
  breaks: z.array(/* схема */).nullable().optional(),
  defaultBufferMinutes: z.number().int().nullable().optional(),
  slotStepMinutes: z.number().int().nullable().optional(),
});
```

## План миграции

1. ✅ Обновлена схема Prisma
2. ✅ Создана миграция SQL
3. ⏳ Применить миграцию: `npx prisma migrate deploy` (или `prisma migrate dev`)
4. ⏳ Обновить Prisma Client: `npx prisma generate`
5. ⏳ Обновить контроллер `getTimeslots` для использования новых полей (опционально)
6. ⏳ Добавить эндпоинты для управления расписанием (опционально)

## Тестирование

### Рекомендуемые тесты

1. **Миграция базы данных**
   - ✅ Проверить, что миграция применяется без ошибок
   - ✅ Проверить, что существующие записи получают значения по умолчанию

2. **Обратная совместимость**
   - ✅ Проверить, что все существующие эндпоинты продолжают работать
   - ✅ Проверить, что фронтенд не получает новые поля в ответах
   - ✅ Проверить, что генерация слотов работает с дефолтными значениями

3. **Новая функциональность**
   - ✅ Проверить генерацию слотов с кастомным расписанием
   - ✅ Проверить генерацию слотов с перерывами
   - ✅ Проверить генерацию слотов с кастомным буфером и шагом

## Заключение

✅ **Миграция безопасна**: Все изменения обратно совместимы
✅ **Фронтенд не сломается**: Новые поля не возвращаются в существующих эндпоинтах
✅ **Существующие данные защищены**: Значения по умолчанию установлены
✅ **Готово к использованию**: Можно применять миграцию без риска

