/**
 * Скрипт для ручного применения миграции полей контактов и рейтинга
 * Используется когда migrate dev не может применить миграцию автоматически
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

const prisma = new PrismaClient();

dotenv.config();

async function applyMigration() {
  try {
    console.log('Применение миграции для добавления полей контактов и рейтинга...\n');

    // Проверяем подключение
    await prisma.$connect();
    console.log('✅ Подключение к базе данных установлено\n');

    // Выполняем SQL напрямую через $executeRawUnsafe
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vkUrl" TEXT;
    `);
    console.log('✅ Добавлено поле vkUrl в таблицу User');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramUrl" TEXT;
    `);
    console.log('✅ Добавлено поле telegramUrl в таблицу User');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "whatsappUrl" TEXT;
    `);
    console.log('✅ Добавлено поле whatsappUrl в таблицу User');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "backgroundImageUrl" TEXT;
    `);
    console.log('✅ Добавлено поле backgroundImageUrl в таблицу User');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rating" DECIMAL(3,2);
    `);
    console.log('✅ Добавлено поле rating в таблицу User');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
    `);
    console.log('✅ Добавлено поле photoUrl в таблицу Service');

    console.log('\n✅ Миграция успешно применена!');
    console.log('Теперь можно запустить: npm run update-contacts anna-krasotkina');
  } catch (error: any) {
    if (error?.code === 'P2022') {
      console.error('\n❌ Ошибка: Поля уже существуют в базе данных или произошла ошибка при добавлении.');
      console.error('Попробуйте выполнить SQL напрямую через psql или другой SQL клиент.');
      console.error('\nSQL команды находятся в файле: scripts/apply-migration-manually.sql');
    } else {
      console.error('Ошибка при применении миграции:', error);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();

