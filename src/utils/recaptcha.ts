/**
 * Утилита для проверки Google reCAPTCHA v3
 * Получите токен от клиента и вызовите verifyCaptcha(token)
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
    return false;
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    // В режиме разработки можно пропустить проверку, если ключ не установлен
    if (process.env.NODE_ENV === 'development') {
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
      return false;
    }

    const data = (await response.json()) as RecaptchaResponse;

    if (!data.success) {
      return false;
    }

    const minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');
    if (data.score !== undefined && data.score < minScore) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
