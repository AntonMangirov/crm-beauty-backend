/**
 * Скрипт для обновления контактов мастера (телефон, соцсети, мессенджеры)
 * 
 * Использование:
 * npm run update-contacts anna-krasotkina
 * 
 * Или с параметрами:
 * npm run update-contacts anna-krasotkina --phone "+79991234567" --vk "https://vk.com/..." --telegram "https://t.me/..." --whatsapp "https://wa.me/..."
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

const prisma = new PrismaClient();

dotenv.config();

interface UpdateData {
  phone?: string;
  vkUrl?: string;
  telegramUrl?: string;
  whatsappUrl?: string;
}

async function updateMasterContacts(
  slug: string,
  data: UpdateData
) {
  try {
    const user = await prisma.user.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        phone: true,
      },
    });

    if (!user) {
      console.error(`Пользователь с slug "${slug}" не найден`);
      return;
    }

    // Сначала проверяем, существуют ли поля в БД
    // Если нет - используем только phone (который точно есть)
    const updateData: Record<string, string | null> = {};
    
    if (data.phone !== undefined) {
      updateData.phone = data.phone || null;
    }
    if (data.vkUrl !== undefined) {
      updateData.vkUrl = data.vkUrl || null;
    }
    if (data.telegramUrl !== undefined) {
      updateData.telegramUrl = data.telegramUrl || null;
    }
    if (data.whatsappUrl !== undefined) {
      updateData.whatsappUrl = data.whatsappUrl || null;
    }
    
    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    console.log(`✅ Контакты обновлены для ${user.slug} (${user.name})`);
    console.log(`   Телефон: ${data.phone || user.phone || 'не указан'}`);
    if (data.vkUrl) console.log(`   VK: ${data.vkUrl}`);
    if (data.telegramUrl) console.log(`   Telegram: ${data.telegramUrl}`);
    if (data.whatsappUrl) console.log(`   WhatsApp: ${data.whatsappUrl}`);
    
  } catch (error) {
    console.error('Ошибка при обновлении контактов:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем slug из аргументов командной строки
const slug = process.argv[2];

if (!slug) {
  console.error('Использование: npm run update-contacts <slug> [--phone <phone>] [--vk <url>] [--telegram <url>] [--whatsapp <url>]');
  console.error('Пример: npm run update-contacts anna-krasotkina --phone "+79991234567"');
  process.exit(1);
}

// Парсим дополнительные аргументы
const args = process.argv.slice(3);
const updateData: UpdateData = {};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i]?.replace('--', '');
  const value = args[i + 1];
  
  if (key === 'phone') {
    updateData.phone = value;
  } else if (key === 'vk') {
    updateData.vkUrl = value;
  } else if (key === 'telegram') {
    updateData.telegramUrl = value;
  } else if (key === 'whatsapp') {
    updateData.whatsappUrl = value;
  }
}

// Если параметры не переданы, используем тестовые данные
if (Object.keys(updateData).length === 0) {
  updateData.phone = '+79991234567';
  updateData.vkUrl = 'https://vk.com/anna_krasotkina';
  updateData.telegramUrl = 'https://t.me/anna_krasotkina';
  updateData.whatsappUrl = 'https://wa.me/79991234567';
  console.log('Используются тестовые данные для демонстрации');
}

updateMasterContacts(slug, updateData);

