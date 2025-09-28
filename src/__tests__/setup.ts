import { PrismaClient } from '@prisma/client';

// Настройка для тестов
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Очистка базы данных перед каждым тестом
global.beforeEach = async () => {
  // Очищаем все таблицы в правильном порядке
  await prisma.appointment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.client.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.user.deleteMany();
};

// Закрываем соединение после всех тестов
global.afterAll = async () => {
  await prisma.$disconnect();
};

export { prisma };
