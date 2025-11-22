-- Миграция для добавления полей контактов и рейтинга
-- Выполнить через psql или другой SQL клиент

-- Добавляем поля в таблицу User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vkUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsappUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "backgroundImageUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rating" DECIMAL(3,2);

-- Добавляем поле в таблицу Service
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;


