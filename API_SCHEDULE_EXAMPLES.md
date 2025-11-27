# Примеры использования API для обновления расписания

## Эндпоинт

**PUT** `/api/me/schedule`

Требует авторизации (токен в заголовке `Authorization: Bearer <token>`)

## Примеры запросов

### Пример 1: Полное расписание с несколькими интервалами в день

```bash
curl -X PUT http://localhost:3000/api/me/schedule \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workSchedule": [
      {
        "dayOfWeek": 1,
        "intervals": [
          { "from": "09:00", "to": "13:00" },
          { "from": "14:00", "to": "19:00" }
        ]
      },
      {
        "dayOfWeek": 2,
        "intervals": [
          { "from": "09:00", "to": "18:00" }
        ]
      },
      {
        "dayOfWeek": 3,
        "intervals": [
          { "from": "10:00", "to": "14:00" },
          { "from": "15:00", "to": "20:00" }
        ]
      },
      {
        "dayOfWeek": 4,
        "intervals": [
          { "from": "09:00", "to": "18:00" }
        ]
      },
      {
        "dayOfWeek": 5,
        "intervals": [
          { "from": "09:00", "to": "18:00" }
        ]
      }
    ],
    "breaks": [
      {
        "from": "13:00",
        "to": "14:00",
        "reason": "Обед"
      },
      {
        "from": "15:30",
        "to": "15:45",
        "reason": "Кофе-брейк"
      }
    ],
    "defaultBufferMinutes": 20,
    "slotStepMinutes": 15
  }'
```

**Ответ**:
```json
{
  "success": true,
  "message": "Расписание успешно обновлено",
  "schedule": {
    "workSchedule": [
      {
        "dayOfWeek": 1,
        "intervals": [
          { "from": "09:00", "to": "13:00" },
          { "from": "14:00", "to": "19:00" }
        ]
      },
      {
        "dayOfWeek": 2,
        "intervals": [
          { "from": "09:00", "to": "18:00" }
        ]
      },
      {
        "dayOfWeek": 3,
        "intervals": [
          { "from": "10:00", "to": "14:00" },
          { "from": "15:00", "to": "20:00" }
        ]
      },
      {
        "dayOfWeek": 4,
        "intervals": [
          { "from": "09:00", "to": "18:00" }
        ]
      },
      {
        "dayOfWeek": 5,
        "intervals": [
          { "from": "09:00", "to": "18:00" }
        ]
      }
    ],
    "breaks": [
      {
        "from": "13:00",
        "to": "14:00",
        "reason": "Обед"
      },
      {
        "from": "15:30",
        "to": "15:45",
        "reason": "Кофе-брейк"
      }
    ],
    "defaultBufferMinutes": 20,
    "slotStepMinutes": 15
  }
}
```

### Пример 2: Обновление только буфера и шага слотов

```bash
curl -X PUT http://localhost:3000/api/me/schedule \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "defaultBufferMinutes": 25,
    "slotStepMinutes": 10
  }'
```

**Ответ**:
```json
{
  "success": true,
  "message": "Расписание успешно обновлено",
  "schedule": {
    "workSchedule": null,
    "breaks": null,
    "defaultBufferMinutes": 25,
    "slotStepMinutes": 10
  }
}
```

### Пример 3: Обновление только расписания работы

```bash
curl -X PUT http://localhost:3000/api/me/schedule \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workSchedule": [
      {
        "dayOfWeek": 1,
        "intervals": [
          { "from": "10:00", "to": "17:00" }
        ]
      },
      {
        "dayOfWeek": 2,
        "intervals": [
          { "from": "10:00", "to": "17:00" }
        ]
      },
      {
        "dayOfWeek": 3,
        "intervals": [
          { "from": "10:00", "to": "17:00" }
        ]
      },
      {
        "dayOfWeek": 4,
        "intervals": [
          { "from": "10:00", "to": "17:00" }
        ]
      },
      {
        "dayOfWeek": 5,
        "intervals": [
          { "from": "10:00", "to": "17:00" }
        ]
      }
    ]
  }'
```

### Пример 4: Обновление только перерывов

```bash
curl -X PUT http://localhost:3000/api/me/schedule \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "breaks": [
      {
        "from": "13:00",
        "to": "14:00",
        "reason": "Обеденный перерыв"
      }
    ]
  }'
```

## Примеры ошибок валидации

### Ошибка 1: Пересекающиеся интервалы

```bash
curl -X PUT http://localhost:3000/api/me/schedule \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workSchedule": [
      {
        "dayOfWeek": 1,
        "intervals": [
          { "from": "09:00", "to": "13:00" },
          { "from": "12:00", "to": "18:00" }
        ]
      }
    ]
  }'
```

**Ответ** (400 Bad Request):
```json
{
  "error": "Validation error",
  "message": "Ошибка валидации данных расписания",
  "details": {
    "fieldErrors": {
      "workSchedule": [
        "Рабочие интервалы не должны пересекаться"
      ]
    }
  }
}
```

### Ошибка 2: Неправильный формат времени

```bash
curl -X PUT http://localhost:3000/api/me/schedule \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workSchedule": [
      {
        "dayOfWeek": 1,
        "intervals": [
          { "from": "9:00", "to": "18:00" }
        ]
      }
    ]
  }'
```

**Ответ** (400 Bad Request):
```json
{
  "error": "Validation error",
  "message": "Ошибка валидации данных расписания",
  "details": {
    "fieldErrors": {
      "workSchedule[0].intervals[0].from": [
        "Время должно быть в формате HH:mm (например, 09:00)"
      ]
    }
  }
}
```

### Ошибка 3: from >= to

```bash
curl -X PUT http://localhost:3000/api/me/schedule \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workSchedule": [
      {
        "dayOfWeek": 1,
        "intervals": [
          { "from": "18:00", "to": "09:00" }
        ]
      }
    ]
  }'
```

**Ответ** (400 Bad Request):
```json
{
  "error": "Validation error",
  "message": "Ошибка валидации данных расписания",
  "details": {
    "fieldErrors": {
      "workSchedule[0].intervals[0]": [
        "Время начала (from) должно быть меньше времени окончания (to)"
      ]
    }
  }
}
```

### Ошибка 4: Перерыв выходит за рабочий интервал

```bash
curl -X PUT http://localhost:3000/api/me/schedule \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workSchedule": [
      {
        "dayOfWeek": 1,
        "intervals": [
          { "from": "09:00", "to": "13:00" }
        ]
      }
    ],
    "breaks": [
      {
        "from": "14:00",
        "to": "15:00",
        "reason": "Обед"
      }
    ]
  }'
```

**Ответ** (400 Bad Request):
```json
{
  "error": "Validation error",
  "message": "Ошибка валидации данных расписания",
  "details": {
    "formErrors": [
      "Перерывы должны находиться внутри рабочих интервалов"
    ]
  }
}
```

### Ошибка 5: Неправильный шаг слота

```bash
curl -X PUT http://localhost:3000/api/me/schedule \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slotStepMinutes": 20
  }'
```

**Ответ** (400 Bad Request):
```json
{
  "error": "Validation error",
  "message": "Ошибка валидации данных расписания",
  "details": {
    "fieldErrors": {
      "slotStepMinutes": [
        "Invalid enum value. Expected 5 | 10 | 15, received 20"
      ]
    }
  }
}
```

### Ошибка 6: Буфер вне допустимого диапазона

```bash
curl -X PUT http://localhost:3000/api/me/schedule \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "defaultBufferMinutes": 5
  }'
```

**Ответ** (400 Bad Request):
```json
{
  "error": "Validation error",
  "message": "Ошибка валидации данных расписания",
  "details": {
    "fieldErrors": {
      "defaultBufferMinutes": [
        "Буфер должен быть не менее 10 минут"
      ]
    }
  }
}
```

### Ошибка 7: Дубликаты дней недели

```bash
curl -X PUT http://localhost:3000/api/me/schedule \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workSchedule": [
      {
        "dayOfWeek": 1,
        "intervals": [
          { "from": "09:00", "to": "18:00" }
        ]
      },
      {
        "dayOfWeek": 1,
        "intervals": [
          { "from": "10:00", "to": "19:00" }
        ]
      }
    ]
  }'
```

**Ответ** (400 Bad Request):
```json
{
  "error": "Validation error",
  "message": "Ошибка валидации данных расписания",
  "details": {
    "fieldErrors": {
      "workSchedule": [
        "Не должно быть дубликатов дней недели в расписании"
      ]
    }
  }
}
```

## Структура данных

### workSchedule
- Массив объектов с расписанием по дням недели
- Каждый объект содержит:
  - `dayOfWeek`: число от 0 до 6 (0 = воскресенье, 1 = понедельник, ..., 6 = суббота)
  - `intervals`: массив рабочих интервалов
    - `from`: время начала в формате "HH:mm"
    - `to`: время окончания в формате "HH:mm"

### breaks
- Массив перерывов
- Каждый перерыв содержит:
  - `from`: время начала в формате "HH:mm"
  - `to`: время окончания в формате "HH:mm"
  - `reason`: опциональная причина перерыва (максимум 200 символов)

### defaultBufferMinutes
- Число от 10 до 30
- Буфер после услуги в минутах

### slotStepMinutes
- Одно из значений: 5, 10 или 15
- Шаг генерации слотов в минутах

## Примечания

1. Все поля опциональны - можно обновлять только нужные поля
2. Валидация проверяет:
   - Формат времени (HH:mm)
   - from < to для всех интервалов
   - Отсутствие пересечений интервалов
   - Перерывы находятся внутри рабочих интервалов
   - Отсутствие дубликатов дней недели
   - Буфер в диапазоне 10-30 минут
   - Шаг слота только 5, 10 или 15 минут
3. Старый API продолжает работать - изменения обратно совместимы

