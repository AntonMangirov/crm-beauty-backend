/**
 * Скрипт для установки тестовых координат мастерам
 * Используется для тестирования карты, когда геокодинг не работает
 */

import dotenv from 'dotenv';
import prisma from '../src/prismaClient';

dotenv.config();

// Тестовые координаты (Москва, центр)
const TEST_COORDINATES = {
  lat: 55.7558,
  lng: 37.6173,
};

async function setTestCoordinates() {
  try {
    // Находим всех мастеров без координат
    const users = await prisma.user.findMany({
      where: {
        OR: [{ lat: null }, { lng: null }],
        address: { not: null },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        address: true,
      },
    });

    if (users.length === 0) {
      console.log('Нет пользователей для установки координат');
      return;
    }

    console.log(`Найдено ${users.length} пользователей без координат\n`);

    for (const user of users) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lat: TEST_COORDINATES.lat,
          lng: TEST_COORDINATES.lng,
        },
      });

      console.log(
        `✅ Установлены координаты для ${user.slug} (${user.name})`
      );
      console.log(`   Адрес: ${user.address}`);
      console.log(
        `   Координаты: ${TEST_COORDINATES.lat}, ${TEST_COORDINATES.lng}\n`
      );
    }

    console.log('Готово! Теперь карта должна отображаться на странице мастера');
  } catch (error) {
    console.error('Ошибка при установке координат:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setTestCoordinates();

