# Инструкция по применению миграции

## Проблема
Миграция была создана, но поля не были добавлены в базу данных.

## Решение

### Вариант 1: Через скрипт (рекомендуется)

1. Убедитесь, что `.env` файл содержит правильный `DATABASE_URL`:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/crm_beauty?schema=public"
   ```

2. Выполните скрипт:
   ```bash
   npm run apply-migration
   ```

### Вариант 2: Через psql напрямую

1. Подключитесь к базе данных:
   ```bash
   psql -U postgres -d crm_beauty
   ```

2. Выполните SQL команды из файла `scripts/apply-migration-manually.sql`:
   ```sql
   ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vkUrl" TEXT;
   ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramUrl" TEXT;
   ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsappUrl" TEXT;
   ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "backgroundImageUrl" TEXT;
   ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rating" DECIMAL(3,2);
   ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
   ```

3. Перегенерируйте Prisma Client:
   ```bash
   npx prisma generate
   ```

### Вариант 3: Через Prisma Studio

1. Откройте Prisma Studio:
   ```bash
   npm run db:studio
   ```

2. Выполните SQL команды через встроенный SQL редактор (если доступен)

## После применения миграции

1. Обновите данные мастера:
   ```bash
   npm run update-contacts anna-krasotkina
   ```

2. Перезапустите backend сервер

## Проверка

Проверить, что поля добавлены, можно через Prisma Studio или SQL запрос:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'User' 
AND column_name IN ('vkUrl', 'telegramUrl', 'whatsappUrl', 'backgroundImageUrl', 'rating');
```

