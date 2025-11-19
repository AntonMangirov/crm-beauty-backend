/**
 * Скрипт для ручного геокодинга адресов мастеров
 * 
 * Использование:
 * npx ts-node scripts/geocode-masters.ts
 * 
 * Или для конкретного мастера:
 * npx ts-node scripts/geocode-masters.ts anna-krasotkina
 */

import dotenv from 'dotenv';
import prisma from '../src/prismaClient';
import { geocodeAndCache } from '../src/utils/geocoding';

dotenv.config();

async function geocodeMasters(specificSlug?: string) {
  try {
    const where = specificSlug
      ? { slug: specificSlug }
      : {
          address: { not: null },
          OR: [{ lat: null }, { lng: null }],
        };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        address: true,
        lat: true,
        lng: true,
      },
    });

    if (users.length === 0) {
      console.log('Нет пользователей для геокодинга');
      return;
    }

    console.log(`Найдено ${users.length} пользователей для геокодинга\n`);

    for (const user of users) {
      if (!user.address) {
        console.log(`⚠️  Пропуск ${user.slug}: нет адреса`);
        continue;
      }

      if (user.lat && user.lng) {
        console.log(`✓ ${user.slug}: координаты уже есть`);
        continue;
      }

      console.log(`🔄 Геокодинг ${user.slug} (${user.name})...`);
      console.log(`   Адрес: ${user.address}`);

      try {
        const coordinates = await geocodeAndCache(
          prisma,
          user.id,
          user.address
        );

        if (coordinates) {
          console.log(
            `   ✅ Успешно: ${coordinates.lat}, ${coordinates.lng}\n`
          );
        } else {
          console.log(`   ❌ Координаты не найдены\n`);
        }

        // Задержка между запросами (1 секунда)
        await new Promise(resolve => global.setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`   ❌ Ошибка:`, error);
        console.log('');
      }
    }

    console.log('Геокодинг завершён');
  } catch (error) {
    console.error('Ошибка при геокодинге:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const specificSlug = process.argv[2];
geocodeMasters(specificSlug);

