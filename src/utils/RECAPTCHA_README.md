# Google reCAPTCHA v3 — Документация

## Описание

Защита от ботов при создании записи через публичный API (`POST /api/public/:slug/book`).

## Настройка

### 1. Получение ключей

1. Перейдите на [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Создайте новый сайт:
   - **Label**: название вашего проекта
   - **reCAPTCHA type**: выберите **reCAPTCHA v3**
   - **Domains**: добавьте домены вашего сайта (например, `localhost`, `yourdomain.com`)
3. После создания вы получите:
   - **Site Key** (публичный ключ) — используется на фронтенде
   - **Secret Key** (секретный ключ) — используется на бэкенде

### 2. Настройка переменных окружения

Добавьте в `.env`:

```env
RECAPTCHA_SECRET_KEY=your_secret_key_here
RECAPTCHA_MIN_SCORE=0.5
```

**RECAPTCHA_SECRET_KEY** (обязательно):
- Секретный ключ, полученный в Google reCAPTCHA Admin Console
- Используется для проверки токенов на бэкенде

**RECAPTCHA_MIN_SCORE** (опционально, по умолчанию 0.5):
- Минимальный score для прохождения проверки
- Диапазон: 0.0 (бот) до 1.0 (человек)
- Рекомендуемое значение: 0.5

### 3. Режим разработки

В режиме разработки (`NODE_ENV=development`), если `RECAPTCHA_SECRET_KEY` не установлен, проверка будет пропущена (вернёт `true`). Это позволяет разрабатывать без настройки reCAPTCHA.

## Использование

### Backend

Проверка выполняется автоматически в контроллере `bookPublicSlot`:

```typescript
import { verifyCaptcha } from '../utils/recaptcha';

const isValid = await verifyCaptcha(recaptchaToken);
if (!isValid) {
  return res.status(400).json({
    error: 'reCAPTCHA verification failed',
    message: 'Проверка на бота не пройдена',
  });
}
```

### Frontend

На фронтенде нужно:

1. Подключить reCAPTCHA v3 скрипт
2. Получить токен перед отправкой формы
3. Отправить токен вместе с данными записи

Пример:

```typescript
// Загрузка reCAPTCHA
const script = document.createElement('script');
script.src = 'https://www.google.com/recaptcha/api.js?render=YOUR_SITE_KEY';
document.body.appendChild(script);

// Получение токена перед отправкой
window.grecaptcha.ready(() => {
  window.grecaptcha.execute('YOUR_SITE_KEY', { action: 'booking' })
    .then((token) => {
      // Отправить token вместе с данными записи
      fetch('/api/public/:slug/book', {
        method: 'POST',
        body: JSON.stringify({
          ...bookingData,
          recaptchaToken: token,
        }),
      });
    });
});
```

## Проверка score

reCAPTCHA v3 возвращает score (0.0 - 1.0), который показывает вероятность того, что запрос от человека:

- **1.0**: очень вероятно человек
- **0.5**: возможно человек
- **0.0**: очень вероятно бот

По умолчанию используется порог 0.5. Вы можете изменить его через `RECAPTCHA_MIN_SCORE`.

## Обработка ошибок

Если проверка не пройдена, API вернёт:

```json
{
  "error": "reCAPTCHA verification failed",
  "message": "Проверка на бота не пройдена. Пожалуйста, попробуйте снова."
}
```

Статус код: `400 Bad Request`

## Логирование

Все проверки логируются:

- `[RECAPTCHA] Проверка пройдена успешно (score: 0.9)`
- `[RECAPTCHA] Низкий score: 0.3 (минимум: 0.5)`
- `[RECAPTCHA] Проверка не пройдена. Ошибки: invalid-input-response`

## Альтернативы

Если reCAPTCHA не подходит, можно использовать:

- **hCaptcha** — альтернатива reCAPTCHA
- **Cloudflare Turnstile** — бесплатная альтернатива
- **Собственные методы защиты** — rate limiting, honeypot поля и т.д.


