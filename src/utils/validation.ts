/**
 * Утилиты для валидации данных
 */

/**
 * Валидация формата телефона (российский формат)
 * Поддерживает форматы:
 * - +7 (999) 123-45-67
 * - +79991234567
 * - 8 (999) 123-45-67
 * - 89991234567
 * - +7 999 123 45 67
 * @param phone - номер телефона
 * @returns true если формат корректный
 */
export function isValidPhoneFormat(phone: string): boolean {
  if (!phone || phone.trim().length === 0) {
    return false;
  }

  // Удаляем все пробелы, скобки, дефисы для проверки
  const cleaned = phone.replace(/[\s\-()]/g, '');

  // Проверяем российский формат:
  // +7XXXXXXXXXX (11 цифр после +7)
  // 8XXXXXXXXXX (11 цифр начиная с 8)
  // 7XXXXXXXXXX (11 цифр начиная с 7)
  const russianPhoneRegex = /^(\+?7|8)?[0-9]{10}$/;

  if (!russianPhoneRegex.test(cleaned)) {
    return false;
  }

  // Проверяем что номер начинается с правильного кода
  if (cleaned.startsWith('+7') || cleaned.startsWith('7')) {
    return cleaned.length === 12; // +7 + 10 цифр
  }
  if (cleaned.startsWith('8')) {
    return cleaned.length === 11; // 8 + 10 цифр
  }

  return false;
}

/**
 * Нормализует номер телефона к формату +7XXXXXXXXXX
 * @param phone - номер телефона
 * @returns нормализованный номер или null если невалидный
 */
export function normalizePhone(phone: string): string | null {
  if (!isValidPhoneFormat(phone)) {
    return null;
  }

  // Удаляем все пробелы, скобки, дефисы
  const cleaned = phone.replace(/[\s\-()]/g, '');

  // Нормализуем к формату +7XXXXXXXXXX
  if (cleaned.startsWith('+7')) {
    return cleaned;
  }
  if (cleaned.startsWith('8')) {
    return '+7' + cleaned.slice(1);
  }
  if (cleaned.startsWith('7')) {
    return '+' + cleaned;
  }

  // Если начинается с цифры (без кода страны)
  if (/^[0-9]{10}$/.test(cleaned)) {
    return '+7' + cleaned;
  }

  return null;
}

/**
 * Проверяет что дата находится в допустимом диапазоне для записи
 * @param date - дата для проверки
 * @param minAdvanceHours - минимальное время записи заранее в часах (по умолчанию 2)
 * @param maxAdvanceDays - максимальное время записи заранее в днях (по умолчанию 30)
 * @returns true если дата допустима
 */
export function isValidBookingDate(
  date: Date,
  minAdvanceHours: number = 2,
  maxAdvanceDays: number = 30
): boolean {
  const now = new Date();
  const minTime = new Date(now.getTime() + minAdvanceHours * 60 * 60 * 1000);
  const maxTime = new Date(
    now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000
  );

  return date >= minTime && date <= maxTime;
}

/**
 * Проверяет что время находится в рабочих часах
 * @param date - время для проверки
 * @param workStartHour - час начала работы (по умолчанию 9)
 * @param workEndHour - час окончания работы (по умолчанию 18)
 * @returns true если время в рабочих часах
 */
export function isWorkingHours(
  date: Date,
  workStartHour: number = 9,
  workEndHour: number = 18
): boolean {
  const hour = date.getUTCHours();
  return hour >= workStartHour && hour < workEndHour;
}

/**
 * Проверяет что время не попадает на выходные
 * @param date - время для проверки
 * @returns true если это рабочий день
 */
export function isWorkingDay(date: Date): boolean {
  const dayOfWeek = date.getUTCDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5; // Понедельник = 1, Воскресенье = 0
}
