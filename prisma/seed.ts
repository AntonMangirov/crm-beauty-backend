import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Начинаем заполнение базы данных...\n');

  // Хэш пароля для всех мастеров
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 10);

  // Мастер 1: Анна - специалист по маникюру
  console.log('👩‍💅 Создаем мастера Анну...');
  const anna = await prisma.user.upsert({
    where: { email: 'anna@example.com' },
    update: {},
    create: {
      email: 'anna@example.com',
      passwordHash,
      name: 'Анна Красоткина',
      slug: 'anna-krasotkina',
      description:
        'Профессиональный мастер маникюра с 5-летним опытом. Специализируюсь на классическом и аппаратном маникюре.',
      phone: '+7-999-123-45-67',
      address: 'ул. Красоты, д. 1, кв. 10',
    },
  });

  // Услуги для Анны
  const annaServices = await prisma.service.findMany({
    where: { masterId: anna.id },
  });

  if (annaServices.length === 0) {
    await prisma.service.createMany({
      data: [
        {
          masterId: anna.id,
          name: 'Классический маникюр',
          price: 1500,
          durationMin: 60,
          description: 'Обрезной маникюр с покрытием обычным лаком',
        },
        {
          masterId: anna.id,
          name: 'Маникюр + гель-лак',
          price: 2500,
          durationMin: 90,
          description: 'Полный маникюр с покрытием гель-лаком',
        },
        {
          masterId: anna.id,
          name: 'Аппаратный маникюр',
          price: 2000,
          durationMin: 75,
          description: 'Маникюр с использованием аппарата',
        },
        {
          masterId: anna.id,
          name: 'Френч',
          price: 3000,
          durationMin: 120,
          description: 'Французский маникюр с гель-лаком',
        },
      ],
    });
    console.log('✅ Создано 4 услуги для Анны');
  }

  // Мастер 2: Мария - специалист по педикюру и маникюру
  console.log('\n👩‍💼 Создаем мастера Марию...');
  const maria = await prisma.user.upsert({
    where: { email: 'maria@example.com' },
    update: {},
    create: {
      email: 'maria@example.com',
      passwordHash,
      name: 'Мария Стильная',
      slug: 'maria-stilnaya',
      description:
        'Мастер широкого профиля: маникюр, педикюр, наращивание ногтей. Работаю с любыми материалами.',
      phone: '+7-999-987-65-43',
      address: 'пр. Красоты, д. 15, оф. 3',
    },
  });

  // Услуги для Марии
  const mariaServices = await prisma.service.findMany({
    where: { masterId: maria.id },
  });

  if (mariaServices.length === 0) {
    await prisma.service.createMany({
      data: [
        {
          masterId: maria.id,
          name: 'Педикюр классический',
          price: 2000,
          durationMin: 90,
          description: 'Полный педикюр с покрытием лаком',
        },
        {
          masterId: maria.id,
          name: 'Педикюр + гель-лак',
          price: 3000,
          durationMin: 120,
          description: 'Педикюр с покрытием гель-лаком',
        },
        {
          masterId: maria.id,
          name: 'Наращивание ногтей',
          price: 4000,
          durationMin: 180,
          description: 'Наращивание ногтей гелем или акрилом',
        },
        {
          masterId: maria.id,
          name: 'Коррекция наращивания',
          price: 2500,
          durationMin: 90,
          description: 'Коррекция нарощенных ногтей',
        },
        {
          masterId: maria.id,
          name: 'Снятие наращивания',
          price: 1000,
          durationMin: 45,
          description: 'Безопасное снятие нарощенных ногтей',
        },
      ],
    });
    console.log('✅ Создано 5 услуг для Марии');
  }

  console.log('\n🎉 Seed завершен успешно!');
  console.log('\n📋 Созданные мастера:');
  console.log(
    '👩‍💅 Анна Красоткина (anna@example.com) - специалист по маникюру'
  );
  console.log(
    '👩‍💼 Мария Стильная (maria@example.com) - мастер широкого профиля'
  );
  console.log('\n🔑 Пароль для всех мастеров: password123');
  console.log('\n📊 Статистика:');

  const totalMasters = await prisma.user.count();
  const totalServices = await prisma.service.count();

  console.log(`👥 Мастеров: ${totalMasters}`);
  console.log(`💅 Услуг: ${totalServices}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
