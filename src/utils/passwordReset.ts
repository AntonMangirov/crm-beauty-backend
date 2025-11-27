import { logError } from './logger';
import { PasswordResetType } from '@prisma/client';

/**
 * Утилиты для работы с восстановлением пароля
 */

/**
 * Генерирует случайный 6-значный код для восстановления пароля
 */
export function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Генерирует криптографически безопасный токен для восстановления пароля
 */
export function generateResetToken(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Заглушка для отправки кода восстановления на email
 * TODO: Интегрировать реальный email сервис (см. PASSWORD_RESET_INTEGRATION.md)
 */
export async function sendResetCodeToEmail(
  email: string,
  code: string
): Promise<boolean> {
  try {
    // TODO: Заменить на реальную отправку email
    // Примеры сервисов: SendGrid, Mailgun, AWS SES, Nodemailer с SMTP

    // В режиме разработки выводим код в консоль
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PASSWORD RESET EMAIL] To: ${email}`);
      console.log(`[PASSWORD RESET CODE] ${code}`);
      console.log(
        `[LINK] http://localhost:3000/password-reset?token=TOKEN&code=${code}`
      );
    }

    // Заглушка: имитация отправки
    await new Promise(resolve => setTimeout(resolve, 100));

    // TODO: Реальная отправка email должна выглядеть примерно так:
    /*
    const emailService = require('./emailService'); // или ваш email сервис
    await emailService.send({
      to: email,
      subject: 'Восстановление пароля',
      html: `
        <h2>Восстановление пароля</h2>
        <p>Ваш код для восстановления пароля: <strong>${code}</strong></p>
        <p>Код действителен в течение 15 минут.</p>
        <p>Если вы не запрашивали восстановление пароля, проигнорируйте это письмо.</p>
      `,
    });
    */

    return true;
  } catch (error) {
    logError(`Ошибка отправки кода восстановления на email ${email}`, error);
    return false;
  }
}

/**
 * Заглушка для отправки кода восстановления на телефон через SMS
 * TODO: Интегрировать реальный SMS сервис (см. PASSWORD_RESET_INTEGRATION.md)
 */
export async function sendResetCodeToPhone(
  phone: string,
  code: string
): Promise<boolean> {
  try {
    // TODO: Заменить на реальную отправку SMS
    // Примеры сервисов: Twilio, SMS.ru, Smsc.ru, AWS SNS

    // В режиме разработки выводим код в консоль
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[PASSWORD RESET SMS] To: ${phone}`);
      console.log(`[PASSWORD RESET CODE] ${code}`);
    }

    // Заглушка: имитация отправки
    await new Promise(resolve => setTimeout(resolve, 100));

    // TODO: Реальная отправка SMS должна выглядеть примерно так:
    /*
    const smsService = require('./smsService'); // или ваш SMS сервис
    await smsService.send({
      to: phone,
      message: `Ваш код для восстановления пароля: ${code}. Код действителен 15 минут.`,
    });
    */

    return true;
  } catch (error) {
    logError(`Ошибка отправки кода восстановления на телефон ${phone}`, error);
    return false;
  }
}

/**
 * Отправляет код восстановления в зависимости от типа
 */
export async function sendResetCode(
  type: PasswordResetType,
  destination: string,
  code: string
): Promise<boolean> {
  if (type === 'EMAIL') {
    return sendResetCodeToEmail(destination, code);
  } else if (type === 'PHONE') {
    return sendResetCodeToPhone(destination, code);
  }
  return false;
}
