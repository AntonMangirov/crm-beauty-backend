/**
 * Скрипт для обновления адреса мастера на реальный
 * Используется для тестирования геокодинга
 */

import dotenv from 'dotenv';
import prisma from '../src/prismaClient';

dotenv.config();

// Реальные адреса для тестирования (Москва)
const REAL_ADDRESSES = [
  'Москва, Красная площадь, 1', // Красная площадь
  'Москва, Тверская улица, 10', // Тверская
  'Москва, Арбат, 1', // Арбат
];

async function updateMasterAddress(slug: string, address?: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        address: true,
      },
    });

    if (!user) {
      console.error(`Пользователь с slug "${slug}" не найден`);
      return;
    }

    // Если адрес не передан, используем первый из списка
    const newAddress = address || REAL_ADDRESSES[0];

    await prisma.user.update({
      where: { id: user.id },
      data: {
        address: newAddress,
        // Сбрасываем координаты, чтобы геокодинг попытался их получить заново
        lat: null,
        lng: null,
      },
    });

    console.log(`✅ Адрес обновлён для ${user.slug} (${user.name})`);
    console.log(`   Старый адрес: ${user.address || 'не указан'}`);
    console.log(`   Новый адрес: ${newAddress}`);
    console.log(
      `\nТеперь при следующем запросе профиля геокодинг попытается получить координаты для этого адреса.\n`
    );
  } catch (error) {
    console.error('Ошибка при обновлении адреса:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем slug из аргументов командной строки
const slug = process.argv[2] || 'anna-krasotkina';
const address = process.argv[3]; // Опциональный адрес

updateMasterAddress(slug, address);


