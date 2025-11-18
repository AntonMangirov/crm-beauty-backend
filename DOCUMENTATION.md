## CRM Beauty Backend — Документация

### Назначение

Бэкенд для CRM салона красоты: управление мастерами, услугами, записями клиентов, аутентификация и нотификации.

### Технологии

- Node.js, Express
- TypeScript
- Prisma ORM (+ PostgreSQL)
- JWT аутентификация (access токен)
- Zod для валидации
- Helmet, rate limiting, CORS
- Jest + Supertest (базовые e2e тесты)

### Структура

- `src/app.ts` — инициализация приложения и маршруты верхнего уровня
- `src/routes/*` — группировка роутов
- `src/controllers/*` — обработчики
- `src/middleware/*` — безопасность, CORS, время, аутентификация
- `src/schemas/*` — схемы Zod
- `src/prismaClient.ts` — клиент Prisma
- `prisma/schema.prisma` — схема БД

### Аутентификация

- `POST /api/auth/register` — регистрация пользователя (мастера)
- `POST /api/auth/login` — вход, возвращает JWT (`{ token }`)
- `GET /api/auth/me` — профиль текущего пользователя (по JWT)

Требуется заголовок `Authorization: Bearer <token>` для приватных маршрутов.

### Публичные маршруты

- `GET /api/public/:slug` — профиль мастера по слагу
  - Ответ:
    ```json
    {
      "slug": "string",
      "name": "string",
      "photoUrl": "string | null",
      "description": "string | null",
      "address": "string | null",
      "services": [
        {
          "id": "string",
          "name": "string",
          "price": "string",
          "durationMin": number
        }
      ]
    }
    ```
- `POST /api/public/:slug/book` — создание записи клиента к мастеру

### Услуги

- `GET /api/services` — список услуг (демо/защищённость может отличаться по конфигурации)

### Встречи (Appointments)

- `GET /api/appointments?dateFrom&dateTo` — приватный список встреч текущего мастера (по `userId` из токена)
  - Параметры:
    - `dateFrom` (ISO-строка, опционально)
    - `dateTo` (ISO-строка, опционально)
  - Фильтрация:
    - по `masterId = userId`
    - по диапазону дат по полю `startAt` если заданы `dateFrom`/`dateTo`
  - Ответ: массив встреч с вложенными данными `master`, `client`, `service`

Пример запроса:

```
GET /api/appointments?dateFrom=2025-11-01T00:00:00.000Z&dateTo=2025-11-30T23:59:59.999Z
Authorization: Bearer <token>
```

### База данных (ключевые сущности)

- `User` (мастер)
- `Service` (услуга)
- `Appointment` (запись): `masterId`, `clientId`, `serviceId`, `startAt`, `endAt`, статусы и т.п.

### Политика времени

- Все даты — в UTC. См. `src/utils/UTC_TIME_POLICY.md`.

### Безопасность

- Helmet, CORS, очистка ввода, лимитер запросов. См. `src/middleware/security.ts`.

### Приватные маршруты (требуют аутентификации)

- `GET /api/users` — список всех пользователей (защищён, требует JWT)
- `GET /api/appointments?dateFrom&dateTo` — список встреч мастера (см. раздел "Встречи")

### Статус сервера

- `GET /api/health` — статус
- `GET /api/db/status` — проверка соединения с БД

### Конфигурация

- `.env.example` — пример файла с переменными окружения
  - `PORT` — порт сервера (по умолчанию 3000)
  - `NODE_ENV` — окружение (development/production)
  - `DATABASE_URL` — строка подключения к PostgreSQL
  - `JWT_SECRET` — секретный ключ для JWT токенов
  - `REDIS_URL` — URL для Redis (или `REDIS_HOST` + `REDIS_PORT`)

### CORS

Все эндпоинты настроены с CORS:
- Публичные эндпоинты (`/api/public`) — более мягкая конфигурация
- Приватные эндпоинты (`/api/auth`, `/api/appointments`, `/api/users`) — строгая конфигурация с credentials
- Настройки в `src/middleware/cors.ts`


