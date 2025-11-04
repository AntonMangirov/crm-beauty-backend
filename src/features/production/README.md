# Production Features

Эта папка содержит функции для продакшена, которые не нужны на этапе разработки.

## 📁 Структура файлов для переноса:

### 🔒 Безопасность

```
src/features/production/
├── emailController.ts              → src/controllers/emailController.ts
├── tokens.ts                       → src/utils/tokens.ts
└── argon2Password.ts              → src/utils/argon2Password.ts
```

### 🔄 Аутентификация

```
src/features/production/
├── refreshTokens.ts                → src/controllers/refreshController.ts
├── shortLivedTokens.ts             → src/middleware/tokenValidation.ts
└── authMiddleware.ts               → src/middleware/auth.ts (обновить)
```

### 📧 Email

```
src/features/production/
├── emailService.ts                 → src/services/emailService.ts
├── emailTemplates.ts               → src/templates/emailTemplates.ts
└── emailQueue.ts                   → src/queues/emailQueue.ts
```

## 🚀 Пошаговая инструкция по переносу:

### 1. Email функции

```bash
# Перенос файлов
cp src/features/production/emailController.ts src/controllers/emailController.ts
cp src/features/production/tokens.ts src/utils/tokens.ts

# Обновление схемы БД
# В prisma/schema.prisma добавить поля:
# emailVerifyToken String? @unique
# passwordResetToken String? @unique
# passwordResetExpires DateTime?

# Создание миграции
npx prisma migrate dev --name add_email_fields

# Обновление маршрутов
# В src/routes/auth.ts добавить:
import { sendEmailVerification, verifyEmail, requestPasswordReset, resetPassword } from '../controllers/emailController';

router.post('/send-verification', sendEmailVerification);
router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password/:token', resetPassword);
```

### 2. Argon2 для паролей

```bash
# Перенос файла
cp src/features/production/argon2Password.ts src/utils/argon2Password.ts

# Установка зависимости
npm install argon2

# Обновление src/utils/password.ts
# Заменить bcrypt на argon2 для продакшена
```

### 3. Refresh Tokens

```bash
# Перенос файла
cp src/features/production/refreshTokens.ts src/controllers/refreshController.ts

# Обновление схемы БД
# В prisma/schema.prisma добавить:
# refreshToken String? @unique
# refreshTokenExpires DateTime?

# Создание миграции
npx prisma migrate dev --name add_refresh_tokens

# Обновление маршрутов
# В src/routes/auth.ts добавить:
import { refreshToken, revokeToken } from '../controllers/refreshController';

router.post('/refresh', refreshToken);
router.post('/revoke', revokeToken);
```

## 🔧 Обновление зависимостей:

### Базовые зависимости

```bash
npm install argon2
```

### Email сервисы (выберите один)

```bash
# SendGrid
npm install @sendgrid/mail

# AWS SES
npm install @aws-sdk/client-ses

# Nodemailer (универсальный)
npm install nodemailer @types/nodemailer
```

### Очереди (для email)

```bash
# Redis + Bull
npm install bull redis

# Или простой in-memory
npm install node-cron
```

## 📋 Обновление .env:

```env
# Базовые настройки
DATABASE_URL="postgresql://user:pass@localhost:5432/db"
JWT_SECRET="your-secret-key"
NODE_ENV="production"

# Email настройки
EMAIL_SERVICE="sendgrid" # или "ses", "nodemailer"
SENDGRID_API_KEY="your-sendgrid-key"
AWS_ACCESS_KEY_ID="your-aws-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret"

# Redis (для очередей)
REDIS_URL="redis://localhost:6379"

# Rate limiting
RATE_LIMIT_WINDOW_MS="900000" # 15 минут
RATE_LIMIT_MAX_REQUESTS="100"
```

## 🎯 Порядок добавления функций:

### Этап 1: Базовая безопасность

1. ✅ Rate Limiting (уже реализован)
2. Улучшенная валидация
3. Логирование

### Этап 2: Email система

1. Email верификация
2. Сброс пароля
3. Email сервис

### Этап 3: Продвинутая аутентификация

1. Refresh tokens
2. Argon2 пароли
3. Короткоживущие токены

### Этап 4: Мониторинг

1. Логирование
2. Метрики
3. Алерты

## ⚠️ Важные моменты:

1. **Тестируйте пошагово** - добавляйте функции постепенно
2. **Создавайте миграции** - для каждого изменения схемы БД
3. **Обновляйте типы** - TypeScript должен знать о новых полях
4. **Тестируйте API** - проверяйте все эндпоинты
5. **Документируйте** - обновляйте README с новыми функциями
