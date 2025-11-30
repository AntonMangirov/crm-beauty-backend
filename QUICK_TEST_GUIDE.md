# Быстрое руководство по тестированию истории клиентов

## 🚀 Быстрый старт

### 1. Проверка создания записи с снапшотами

```bash
# 1. Запустите сервер
npm run dev

# 2. Создайте запись через API (используйте Postman или curl)
POST http://localhost:3000/api/public/{masterSlug}/book
{
  "name": "Test Client",
  "phone": "+79991234567",
  "serviceId": "{serviceId}",
  "startAt": "2025-01-28T10:00:00.000Z",
  "source": "MANUAL"
}

# 3. Проверьте снапшоты в базе данных
npx prisma studio
# Откройте таблицу Appointment и проверьте поля:
# - serviceName
# - serviceDuration  
# - servicePrice
```

### 2. Проверка истории с fallback

```bash
# 1. Деактивируйте услугу
PATCH http://localhost:3000/api/me/services/{serviceId}
Authorization: Bearer {token}
{
  "isActive": false
}

# 2. Получите историю клиента
GET http://localhost:3000/api/me/clients/{clientId}/history
Authorization: Bearer {token}

# Ожидаемый результат: история возвращается с данными из снапшотов
```

### 3. Проверка защиты от удаления

```bash
# 1. Попытайтесь удалить услугу с записями
DELETE http://localhost:3000/api/me/services/{serviceId}
Authorization: Bearer {token}

# Ожидаемый результат: 
# Status: 400
# {
#   "error": "Cannot delete service with appointment history",
#   "message": "This service has X appointment(s) in history..."
# }

# 2. Деактивируйте вместо удаления
PATCH http://localhost:3000/api/me/services/{serviceId}
Authorization: Bearer {token}
{
  "isActive": false
}

# Ожидаемый результат: успешно, записи остаются в БД
```

## 📋 SQL запросы для проверки

### Проверка снапшотов
```sql
SELECT 
  id,
  "serviceId",
  "serviceName",
  "serviceDuration",
  "servicePrice",
  price,
  status
FROM "Appointment"
WHERE "clientId" = '{clientId}'
ORDER BY "startAt" DESC;
```

### Проверка защиты от удаления
```sql
-- Попытка удалить Service с записями должна быть заблокирована
DELETE FROM "Service" WHERE id = '{serviceId}';
-- Ожидается ошибка: foreign key constraint violation
```

## ✅ Чек-лист

- [ ] Снапшоты сохраняются при создании записи
- [ ] История доступна при деактивированном Service
- [ ] История использует снапшоты как fallback
- [ ] Нельзя удалить Service с записями
- [ ] Можно деактивировать Service вместо удаления

## 📚 Подробная документация

См. `TESTING_HISTORY_PRESERVATION.md` для полной инструкции.


