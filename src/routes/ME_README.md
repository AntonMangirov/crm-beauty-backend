# Кабинет мастера - API эндпоинты

## Обзор

Все эндпоинты требуют авторизации через JWT токен в заголовке:
```
Authorization: Bearer <token>
```

## Эндпоинты

### GET /api/me
Получить полную информацию о текущем мастере со статистикой.

**Ответ:**
```json
{
  "id": "string",
  "email": "string",
  "name": "string",
  "slug": "string",
  "phone": "string | null",
  "description": "string | null",
  "photoUrl": "string | null",
  "address": "string | null",
  "lat": "number | null",
  "lng": "number | null",
  "vkUrl": "string | null",
  "telegramUrl": "string | null",
  "whatsappUrl": "string | null",
  "backgroundImageUrl": "string | null",
  "rating": "number | null",
  "isActive": true,
  "role": "MASTER",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "stats": {
    "totalServices": 5,
    "activeServices": 4,
    "totalAppointments": 120,
    "upcomingAppointments": 15,
    "completedAppointments": 100,
    "totalClients": 45
  }
}
```

### PUT /api/me/profile
Обновить профиль мастера.

**Тело запроса:**
```json
{
  "name": "string (optional)",
  "phone": "string | null (optional)",
  "description": "string | null (optional)",
  "photoUrl": "string | null (optional)",
  "address": "string | null (optional)",
  "vkUrl": "string | null (optional)",
  "telegramUrl": "string | null (optional)",
  "whatsappUrl": "string | null (optional)",
  "backgroundImageUrl": "string | null (optional)"
}
```

**Ответ:** То же, что и GET /api/me (обновленный профиль со статистикой)

### GET /api/me/appointments
Получить записи мастера с фильтрами.

**Query параметры:**
- `from` (string, optional) - начальная дата (ISO 8601) - предпочтительный параметр
- `to` (string, optional) - конечная дата (ISO 8601) - предпочтительный параметр
- `dateFrom` (string, optional) - начальная дата (ISO 8601) - для обратной совместимости
- `dateTo` (string, optional) - конечная дата (ISO 8601) - для обратной совместимости
- `status` (enum, optional) - статус записи: PENDING, CONFIRMED, COMPLETED, CANCELED, NO_SHOW
- `serviceId` (string, optional) - ID услуги
- `clientId` (string, optional) - ID клиента

**Примеры:**
```
GET /api/me/appointments?from=2024-01-01T00:00:00Z&to=2024-01-31T23:59:59Z
GET /api/me/appointments?status=CONFIRMED&from=2024-01-01T00:00:00Z
GET /api/me/appointments?dateFrom=2024-01-01T00:00:00Z&dateTo=2024-01-31T23:59:59Z
```

**Ответ:**
```json
[
  {
    "id": "string",
    "masterId": "string",
    "clientId": "string",
    "serviceId": "string",
    "startAt": "2024-01-01T10:00:00.000Z",
    "endAt": "2024-01-01T11:00:00.000Z",
    "status": "CONFIRMED",
    "source": "WEB",
    "notes": "string | null",
    "price": "number | null",
    "notificationJobId": "string | null",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "client": {
      "id": "string",
      "name": "string",
      "phone": "string | null",
      "email": "string | null"
    },
    "service": {
      "id": "string",
      "name": "string",
      "price": "number",
      "durationMin": 60
    }
  }
]
```

### GET /api/me/services
Получить все услуги мастера.

**Ответ:** Массив услуг (см. `/api/services`)

### POST /api/me/services
Создать новую услугу.

**Тело запроса:**
```json
{
  "name": "string",
  "price": "number",
  "durationMin": "number",
  "description": "string (optional)"
}
```

### GET /api/me/services/:id
Получить услугу по ID.

### PATCH /api/me/services/:id
Обновить услугу.

**Тело запроса:**
```json
{
  "name": "string (optional)",
  "price": "number (optional)",
  "durationMin": "number (optional)",
  "description": "string (optional)",
  "isActive": "boolean (optional)"
}
```

### DELETE /api/me/services/:id
Удалить услугу (только если нет активных записей).

## Статистика в GET /api/me

- `totalServices` - общее количество услуг мастера
- `activeServices` - количество активных услуг
- `totalAppointments` - общее количество записей
- `upcomingAppointments` - количество предстоящих записей (PENDING или CONFIRMED, startAt в будущем)
- `completedAppointments` - количество завершенных записей
- `totalClients` - общее количество клиентов


