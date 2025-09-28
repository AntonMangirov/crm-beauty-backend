import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // хэш пароля
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 10);

  const master = await prisma.user.upsert({
    where: { email: 'anna@example.com' },
    update: {},
    create: {
      email: 'anna@example.com',
      passwordHash,
      name: 'Anna Beauty',
      slug: 'anna-beauty',
      description:
        'милый домашний салон - маникюр и покрытие. на фоне играет непринужденный реп',
      phone: '+79027671787',
    },
  });

  // парочка услуг
  const existingServices = await prisma.service.findMany({
    where: { masterId: master.id },
  });
  if (existingServices.length === 0) {
    await prisma.service.createMany({
      data: [
        { masterId: master.id, name: 'Маникюр', price: 1500, durationMin: 60 },
        {
          masterId: master.id,
          name: 'Покрытие гель-лак',
          price: 2000,
          durationMin: 90,
        },
      ],
    });
  }

  console.log(
    'Seed: master and services created (email: anna@example.com, pwd: password123)'
  );
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
