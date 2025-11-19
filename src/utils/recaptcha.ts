/**
 * Утилита для проверки Google reCAPTCHA v3
 *
 * Использование:
 * 1. Получите токен от клиента (frontend)
 * 2. Вызовите verifyCaptcha(token)
 * 3. Если вернул true - пользователь прошел проверку
 */

interface RecaptchaResponse {
  success: boolean;
  score?: number; // Для v3: 0.0 (бот) до 1.0 (человек)
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

/**
 * Проверяет токен reCAPTCHA v3 через Google API
 * @param token - токен, полученный от клиента
 * @returns true если проверка пройдена, false в противном случае
 */
export async function verifyCaptcha(token: string): Promise<boolean> {
  if (!token || token.trim().length === 0) {
    console.error('[RECAPTCHA] Токен не предоставлен');
    return false;
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    console.error(
      '[RECAPTCHA] RECAPTCHA_SECRET_KEY не установлен в переменных окружения'
    );
    // В режиме разработки можно пропустить проверку, если ключ не установлен
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[RECAPTCHA] Пропуск проверки в режиме разработки (ключ не установлен)'
      );
      return true;
    }
    return false;
  }

  try {
    const url = 'https://www.google.com/recaptcha/api/siteverify';
    const response = await global.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new global.URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    });

    if (!response.ok) {
      console.error(
        `[RECAPTCHA] Ошибка HTTP: ${response.status} ${response.statusText}`
      );
      return false;
    }

    const data = (await response.json()) as RecaptchaResponse;

    if (!data.success) {
      console.error(
        `[RECAPTCHA] Проверка не пройдена. Ошибки: ${data['error-codes']?.join(', ') || 'неизвестная ошибка'}`
      );
      return false;
    }

    // Для reCAPTCHA v3 проверяем score (рекомендуемый порог: 0.5)
    const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');
    if (data.score !== undefined && data.score < minScore) {
      console.warn(
        `[RECAPTCHA] Низкий score: ${data.score} (минимум: ${minScore})`
      );
      return false;
    }

    console.log(
      `[RECAPTCHA] Проверка пройдена успешно${data.score !== undefined ? ` (score: ${data.score})` : ''}`
    );
    return true;
  } catch (error) {
    console.error('[RECAPTCHA] Ошибка при проверке токена:', error);
    return false;
  }
}
