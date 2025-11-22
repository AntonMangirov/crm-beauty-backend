# Безопасность приложения

## Обзор

Комплексная система безопасности, включающая защиту заголовков, ограничение запросов, CORS и валидацию входных данных.

## Компоненты безопасности

### 1. Helmet - Заголовки безопасности

```typescript
import { helmetConfig } from './middleware/security';
app.use(helmetConfig);
```

**Настройки:**

- **CSP (Content Security Policy)** - предотвращает XSS атаки
- **HSTS** - принудительное использование HTTPS
- **X-Frame-Options** - предотвращает clickjacking
- **X-Content-Type-Options** - предотвращает MIME sniffing
- **X-XSS-Protection** - защита от XSS

### 2. Rate Limiting - Ограничение запросов

#### Общий rate limiter

```typescript
// 100 запросов за 15 минут
app.use(generalRateLimit);
```

#### Аутентификация

```typescript
// 5 попыток входа за 15 минут
app.use('/api/auth', authRateLimit);
```

#### Публичные API

```typescript
// 200 запросов за 15 минут
app.use('/api/public', publicRateLimit);
```

#### Создание записей

```typescript
// 10 записей в час
app.use('/api/public/:slug/book', bookingRateLimit);
```

### 3. CORS - Cross-Origin Resource Sharing

#### Разрешенные origins

```typescript
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://yourdomain.com',
];
```

#### Конфигурации CORS

- **Общий CORS** - для внутренних API
- **Auth CORS** - строгий для аутентификации
- **Public CORS** - мягкий для публичных API

### 4. Валидация и очистка данных

#### Ограничение размера запроса

```typescript
app.use(requestSizeLimit(10 * 1024 * 1024)); // 10MB
```

#### Очистка входных данных

```typescript
app.use(sanitizeInput);
```

**Что очищается:**

- HTML теги (`<script>`, `<iframe>`)
- Длинные строки (обрезаются до 1000 символов)
- Пробелы в начале и конце

## Порядок middleware

```typescript
// 1. Базовые middleware безопасности
app.use(helmetConfig);
app.use(securityHeaders);
app.use(requestSizeLimit(10 * 1024 * 1024));
app.use(sanitizeInput);

// 2. CORS middleware
app.use(corsLogger);
app.use(handlePreflight);

// 3. Общий rate limiting
app.use(generalRateLimit);

// 4. Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 5. Специфичные CORS и rate limiting
app.use('/api/auth', authCorsConfig, authRateLimit, authRouter);
app.use('/api/public', publicCorsConfig, publicRateLimit, publicRouter);
```

## Настройки для production

### Environment Variables

```bash
NODE_ENV=production
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Обновление CORS origins

```typescript
// В src/middleware/cors.ts
const allowedOrigins = [
  'https://yourdomain.com',
  'https://www.yourdomain.com',
  'https://admin.yourdomain.com',
];
```

### Настройка rate limiting для production

```typescript
// Более строгие лимиты для production
export const productionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Снижаем лимит
  // ... остальные настройки
});
```

## Мониторинг безопасности

### Логирование

```typescript
// CORS запросы логируются в development
console.log(`CORS: ${req.method} ${req.path} from ${req.headers.origin}`);
```

### Метрики rate limiting

```typescript
// Отслеживание заблокированных запросов
rateLimit.on('blocked', (req, res, next) => {
  console.warn(`Rate limit exceeded for IP: ${req.ip}`);
});
```

## Тестирование безопасности

### Проверка заголовков

```bash
curl -I http://localhost:3000/api/health
```

**Ожидаемые заголовки:**

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

### Тестирование rate limiting

```bash
# Делаем много запросов
for i in {1..105}; do curl http://localhost:3000/api/health; done
```

### Тестирование CORS

```bash
curl -H "Origin: https://malicious-site.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:3000/api/health
```

## Обработка ошибок безопасности

### Rate Limit Error

```json
{
  "error": "Too many requests from this IP",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": "15 minutes",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "path": "/api/health"
}
```

### CORS Error

```json
{
  "error": "Not allowed by CORS",
  "code": "CORS_ERROR",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "path": "/api/health"
}
```

### Request Too Large Error

```json
{
  "error": "Request entity too large",
  "code": "REQUEST_TOO_LARGE",
  "maxSize": "10MB",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "path": "/api/upload"
}
```

## Лучшие практики

### 1. Регулярное обновление

- Обновляйте helmet и express-rate-limit
- Проверяйте новые уязвимости
- Обновляйте CORS origins

### 2. Мониторинг

- Логируйте заблокированные запросы
- Отслеживайте rate limiting метрики
- Мониторьте CORS ошибки

### 3. Настройка для разных окружений

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

if (isDevelopment) {
  // Более мягкие настройки для разработки
  app.use(devRateLimit);
} else if (isProduction) {
  // Строгие настройки для production
  app.use(productionRateLimit);
}
```

### 4. Безопасность заголовков

```typescript
// Дополнительные заголовки для API
res.set({
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'X-API-Version': '1.0.0',
  'X-Request-ID': generateRequestId(),
});
```

## Troubleshooting

### Проблема: CORS блокирует легитимные запросы

**Решение:** Проверьте список `allowedOrigins` в `cors.ts`

### Проблема: Rate limiting слишком строгий

**Решение:** Увеличьте `max` или `windowMs` в конфигурации

### Проблема: Helmet блокирует ресурсы

**Решение:** Обновите CSP директивы в `helmetConfig`

### Проблема: Большие запросы отклоняются

**Решение:** Увеличьте лимит в `requestSizeLimit`

## Дополнительные меры безопасности

### 1. Валидация входных данных

```typescript
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
```

### 2. Хеширование паролей

```typescript
import bcrypt from 'bcryptjs';

const hashedPassword = await bcrypt.hash(password, 12);
```

### 3. JWT токены

```typescript
import jwt from 'jsonwebtoken';

const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
  expiresIn: '1h',
});
```

### 4. Валидация файлов

```typescript
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
const maxFileSize = 5 * 1024 * 1024; // 5MB
```











