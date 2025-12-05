# Инструкция по применению миграции истории клиентов

## Проблема с shadow database

При попытке создать миграцию через `prisma migrate dev` возникает ошибка:
```
Migration `20250101000000_add_master_contacts_rating_and_service_photo` failed to apply cleanly to the shadow database.
Error: The underlying table for model `User` does not exist.
```

Это происходит потому, что Prisma не может создать shadow database из-за проблем с существующими миграциями.

## Решение

### Вариант 1: Использовать `prisma db push` (для разработки)

Этот метод обновит схему напрямую без создания миграции:

```bash
cd crm-beauty-backend
npx prisma db push
npx prisma generate
```

**Плюсы:** Быстро, работает сразу  
**Минусы:** Не создает файл миграции для продакшена

### Вариант 2: Применить миграцию вручную (рекомендуется для продакшена)

Миграция уже создана вручную в файле:
`prisma/migrations/20250127000000_add_appointment_snapshots_and_restrict_deletes/migration.sql`

#### Шаг 1: Применить миграцию через Prisma (если shadow database работает)

```bash
cd crm-beauty-backend
npx prisma migrate deploy
```

#### Шаг 2: Если Prisma не работает, применить SQL напрямую

Подключитесь к базе данных и выполните SQL из файла миграции:

```bash
# Через psql
psql -h localhost -p 5433 -U your_user -d crm_beauty -f prisma/migrations/20250127000000_add_appointment_snapshots_and_restrict_deletes/migration.sql

# Или через другой SQL клиент
```

#### Шаг 3: Пометить миграцию как примененную

После применения SQL вручную:

```bash
cd crm-beauty-backend
npx prisma migrate resolve --applied 20250127000000_add_appointment_snapshots_and_restrict_deletes
npx prisma generate
```

### Вариант 3: Исправить shadow database

Если нужно исправить проблему с shadow database:

1. Удалите shadow database (если она существует)
2. Убедитесь, что все существующие миграции применены
3. Попробуйте создать миграцию снова:

```bash
cd crm-beauty-backend
npx prisma migrate dev --name add_appointment_snapshots_and_restrict_deletes
```

## Что делает миграция

1. **Добавляет снапшоты в Appointment:**
   - `serviceName` (TEXT, nullable)
   - `serviceDuration` (INTEGER, nullable)
   - `servicePrice` (DECIMAL(10,2), nullable)

2. **Изменяет каскадные удаления:**
   - `Appointment.clientId`: CASCADE → RESTRICT
   - `Appointment.serviceId`: CASCADE → RESTRICT
   - `Photo.clientId`: CASCADE → RESTRICT

3. **Добавляет привязку Photo к Appointment:**
   - `Photo.appointmentId` (TEXT, nullable)
   - `Photo.appointmentId`: SET NULL при удалении Appointment

4. **Добавляет индексы:**
   - `Appointment.serviceId_idx`
   - `Photo.appointmentId_idx`

## Проверка после применения

После применения миграции проверьте:

```bash
# Проверить статус миграций
npx prisma migrate status

# Проверить схему базы данных
npx prisma db pull

# Сгенерировать Prisma Client
npx prisma generate
```

## Важно

⚠️ **Внимание:** Изменение `onDelete: Cascade` на `onDelete: Restrict` означает, что:
- Нельзя удалить Service, если есть Appointment с этой услугой
- Нельзя удалить Client, если есть Appointment или Photo этого клиента
- Нужно использовать soft delete (`isActive = false`) вместо физического удаления
