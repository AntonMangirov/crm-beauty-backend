# API для управления услугами

## Обзор

CRUD endpoints для управления услугами мастера. Все endpoints требуют авторизации.

## Endpoints

### 1. Получить все услуги мастера

```
GET /api/services
Authorization: Bearer <token>
```

**Ответ:**

```json
[
  {
    "id": "service_id",
    "masterId": "master_id",
    "name": "Название услуги",
    "price": 1500,
    "durationMin": 60,
    "description": "Описание услуги",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### 2. Создать новую услугу

```
POST /api/services
Authorization: Bearer <token>
Content-Type: application/json
```

**Тело запроса:**

```json
{
  "name": "Название услуги",
  "price": 1500,
  "durationMin": 60,
  "description": "Описание услуги" // опционально
}
```

**Ответ:** 201 Created + объект услуги

### 3. Получить услугу по ID

```
GET /api/services/:id
Authorization: Bearer <token>
```

**Ответ:** 200 OK + объект услуги

### 4. Обновить услугу

```
PUT /api/services/:id
Authorization: Bearer <token>
Content-Type: application/json
```

**Тело запроса (все поля опциональны):**

```json
{
  "name": "Новое название",
  "price": 2000,
  "durationMin": 90,
  "description": "Новое описание",
  "isActive": false
}
```

**Ответ:** 200 OK + обновленный объект услуги

### 5. Удалить услугу

```
DELETE /api/services/:id
Authorization: Bearer <token>
```

**Ответ:** 204 No Content

## Валидация

- `name`: обязательное, 1-100 символов
- `price`: обязательное, положительное число, максимум 999999.99
- `durationMin`: обязательное, положительное целое число, максимум 1440 минут (24 часа)
- `description`: опциональное, максимум 500 символов

## Ошибки

- `401 Unauthorized` - отсутствует или неверный токен
- `404 Not Found` - услуга не найдена или не принадлежит мастеру
- `400 Bad Request` - ошибки валидации или попытка удалить услугу с активными записями

## Безопасность

- Все endpoints требуют авторизации
- Мастер может управлять только своими услугами
- Нельзя удалить услугу с активными записями (PENDING, CONFIRMED)

















