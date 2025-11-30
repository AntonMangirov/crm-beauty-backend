# Инструкция по тестированию сохранения истории клиентов

## Подготовка

1. Убедитесь, что база данных обновлена:

   ```bash
   cd crm-beauty-backend
   npx prisma db push
   npx prisma generate
   ```

2. Запустите сервер:
   ```bash
   npm run dev
   ```

## Тест 1: Создание записи с проверкой снапшотов

### Цель

Проверить, что при создании Appointment сохраняются снапшоты: `serviceName`, `serviceDuration`, `servicePrice`.

### Шаги

1. **Создайте запись через API:**

   ```bash
   POST http://localhost:3000/api/public/{masterSlug}/book
   Content-Type: application/json

   {
     "name": "Test Client",
     "phone": "+79991234567",
     "serviceId": "{serviceId}",
     "startAt": "2025-01-28T10:00:00.000Z",
     "source": "MANUAL"
   }
   ```

2. **Проверьте снапшоты в базе данных:**

   ```sql
   SELECT
     id,
     "serviceId",
     "serviceName",
     "serviceDuration",
     "servicePrice",
     price
   FROM "Appointment"
   WHERE id = '{appointmentId}';
   ```

3. **Ожидаемый результат:**
   - `serviceName` = название услуги
   - `serviceDuration` = длительность услуги (или кастомная, если указана)
   - `servicePrice` = оригинальная цена услуги (не кастомная цена из `price`)

### Проверка через Prisma Studio

```bash
npx prisma studio
```

Откройте таблицу `Appointment` и проверьте поля снапшотов.

## Тест 2: История с fallback при удаленном Service

### Цель

Проверить, что история клиента доступна даже если Service удален/деактивирован, используя снапшоты.

### Шаги

1. **Создайте запись** (см. Тест 1)

2. **Деактивируйте услугу:**

   ```bash
   PATCH http://localhost:3000/api/me/services/{serviceId}
   Authorization: Bearer {token}
   Content-Type: application/json

   {
     "isActive": false
   }
   ```

3. **Получите историю клиента:**

   ```bash
   GET http://localhost:3000/api/me/clients/{clientId}/history
   Authorization: Bearer {token}
   ```

4. **Ожидаемый результат:**
   - История возвращается успешно
   - В ответе есть данные об услуге из снапшотов:
     ```json
     {
       "id": "...",
       "date": "...",
       "service": {
         "id": "{serviceId}",
         "name": "Название услуги из снапшота",
         "price": 1500
       },
       "status": "COMPLETED",
       "photos": []
     }
     ```

### Проверка через SQL

```sql
-- Проверьте, что снапшоты заполнены
SELECT
  a.id,
  a."serviceName",
  a."serviceDuration",
  a."servicePrice",
  s.name as "service_name_from_relation",
  s."isActive" as "service_is_active"
FROM "Appointment" a
LEFT JOIN "Service" s ON a."serviceId" = s.id
WHERE a."clientId" = '{clientId}'
ORDER BY a."startAt" DESC;
```

## Тест 3: Защита от удаления Service с историей

### Цель

Проверить, что нельзя удалить Service, если есть записи (активные или исторические).

### Шаги

1. **Создайте запись** с услугой (статус COMPLETED для исторической записи)

2. **Попытайтесь удалить услугу:**

   ```bash
   DELETE http://localhost:3000/api/me/services/{serviceId}
   Authorization: Bearer {token}
   ```

3. **Ожидаемый результат:**
   - Статус: `400 Bad Request`
   - Сообщение об ошибке:
     ```json
     {
       "error": "Cannot delete service with appointment history",
       "message": "This service has X appointment(s) in history. Consider deactivating it instead (set isActive = false) to preserve client history."
     }
     ```

4. **Проверьте деактивацию:**

   ```bash
   PATCH http://localhost:3000/api/me/services/{serviceId}
   Authorization: Bearer {token}
   Content-Type: application/json

   {
     "isActive": false
   }
   ```

   - Должно работать успешно
   - Записи остаются в базе данных

### Проверка через SQL

```sql
-- Попытка удалить Service с записями должна быть заблокирована
-- Из-за Restrict constraint в базе данных

-- Проверьте количество записей у услуги
SELECT COUNT(*)
FROM "Appointment"
WHERE "serviceId" = '{serviceId}';

-- Попытка удаления через SQL также должна быть заблокирована
DELETE FROM "Service" WHERE id = '{serviceId}';
-- Ожидается ошибка: "update or delete on table "Service" violates foreign key constraint"
```

## Автоматические тесты

Запустите автоматические тесты:

```bash
cd crm-beauty-backend
npm test -- client-history-preservation.test.ts
```

## Проверка через Prisma Studio

1. Запустите Prisma Studio:

   ```bash
   npx prisma studio
   ```

2. Проверьте:
   - Таблица `Appointment`: поля `serviceName`, `serviceDuration`, `servicePrice` заполнены
   - Таблица `Service`: услуги с историей имеют `isActive = false` вместо удаления
   - Таблица `Client`: клиенты с историей не удалены

## Чек-лист проверки

- [ ] При создании записи сохраняются снапшоты
- [ ] `serviceName` содержит название услуги
- [ ] `serviceDuration` содержит длительность (или кастомную)
- [ ] `servicePrice` содержит оригинальную цену услуги
- [ ] История доступна даже при деактивированном Service
- [ ] История использует снапшоты как fallback
- [ ] Нельзя удалить Service с активными записями
- [ ] Нельзя удалить Service с историческими записями
- [ ] Можно деактивировать Service вместо удаления
- [ ] При деактивации записи остаются в базе данных

## Ожидаемые результаты

### ✅ Успешные сценарии

1. **Создание записи:**
   - Запись создается успешно
   - Снапшоты заполнены корректно

2. **Просмотр истории:**
   - История доступна даже при удаленном Service
   - Данные берутся из снапшотов

3. **Удаление Service:**
   - Удаление блокируется при наличии записей
   - Предлагается использовать деактивацию
   - Деактивация работает корректно

### ❌ Ошибки, которые должны быть исправлены

1. Если снапшоты не сохраняются → проверить код создания Appointment
2. Если история недоступна при удаленном Service → проверить fallback в getClientHistory
3. Если можно удалить Service с историей → проверить Restrict constraint и логику deleteService

