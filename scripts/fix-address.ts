/**
 * Быстрое исправление адреса на реальный
 */

import dotenv from 'dotenv';
import prisma from '../src/prismaClient';

dotenv.config();

async function fixAddress() {
  try {
    // Используем английский адрес для лучшей совместимости с Nominatim
    const realAddress = 'Moscow, Red Square, 1';

    const user = await prisma.user.update({
      where: { slug: 'anna-krasotkina' },
      data: {
        address: realAddress,
        lat: null, // Сбрасываем, чтобы геокодинг получил новые
        lng: null,
      },
      select: {
        slug: true,
        name: true,
        address: true,
      },
    });

    console.log('✅ Адрес обновлён:');
    console.log(`   Пользователь: ${user.name} (${user.slug})`);
    console.log(`   Новый адрес: ${user.address}`);
    console.log('\nТеперь обновите страницу мастера - геокодинг получит координаты автоматически');
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAddress();


