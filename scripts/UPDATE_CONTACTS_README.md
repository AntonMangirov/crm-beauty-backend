# Инструкция по обновлению контактов мастера

## 1. Выполните миграцию базы данных

Добавлены новые поля в схему Prisma:
- `vkUrl` - ссылка на ВКонтакте
- `telegramUrl` - ссылка на Telegram  
- `whatsappUrl` - ссылка на WhatsApp
- `backgroundImageUrl` - фоновое изображение для карточки мастера
- `rating` - средняя оценка из отзывов
- `photoUrl` в модели Service - фото услуги

Выполните миграцию:

```bash
cd crm-beauty-backend
npm run db:migrate
```

При запросе имени миграции используйте: `add_master_contacts_and_rating`

После миграции Prisma Client будет автоматически перегенерирован.

## 2. Обновите данные мастера

Используйте скрипт для обновления контактов:

```bash
npm run update-contacts anna-krasotkina
```

Скрипт автоматически добавит тестовые данные:
- Телефон: +79991234567
- VK: https://vk.com/anna_krasotkina
- Telegram: https://t.me/anna_krasotkina
- WhatsApp: https://wa.me/79991234567

Или укажите свои данные:

```bash
npm run update-contacts anna-krasotkina --phone "+79991234567" --vk "https://vk.com/your_profile" --telegram "https://t.me/your_profile" --whatsapp "https://wa.me/79991234567"
```

## 3. Установите рейтинг (опционально)

Для установки рейтинга можно использовать Prisma Studio:

```bash
npm run db:studio
```

Или напрямую через SQL:

```sql
UPDATE "User" SET rating = 4.8 WHERE slug = 'anna-krasotkina';
```

## 4. Перезапустите сервер

После миграции перезапустите backend сервер, чтобы изменения вступили в силу.


