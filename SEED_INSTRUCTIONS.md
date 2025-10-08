# Инструкции для запуска seed-скрипта

## 1. Настройка базы данных

Создайте файл `.env` в корне проекта со следующим содержимым:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/crm_beauty?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Server
PORT=3000
NODE_ENV=development
```

## 2. Запуск PostgreSQL

Убедитесь, что PostgreSQL запущен на порту 5432 (или измените DATABASE_URL соответственно).

## 3. Выполнение миграций

```bash
npm run db:migrate
```

## 4. Запуск seed-скрипта

```bash
npm run seed
```

Или альтернативно:

```bash
npx ts-node prisma/seed.ts
```

## 5. Проверка результата

После выполнения seed-скрипта в базе данных будут созданы:

- **2 мастера:**
  - Анна Красоткина (anna@example.com) - 4 услуги
  - Мария Стильная (maria@example.com) - 5 услуг

- **Пароль для всех мастеров:** `password123`

## 6. Просмотр данных

Можно использовать Prisma Studio для просмотра данных:

```bash
npm run db:studio
```

## Возможные проблемы

1. **База данных не запущена** - убедитесь, что PostgreSQL запущен
2. **Неправильный DATABASE_URL** - проверьте настройки подключения
3. **База данных не существует** - создайте базу данных `crm_beauty` в PostgreSQL
