/**
 * Утилиты для работы с UTC временем
 * Политика: все время хранится в UTC, фронт работает с ISO строками
 */

/**
 * Преобразует ISO строку в UTC Date объект
 * @param isoString - ISO строка времени (например: "2024-01-01T10:00:00.000Z")
 * @returns Date объект в UTC
 */
export function parseISOToUTC(isoString: string): Date {
  const date = new Date(isoString);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date string: ${isoString}`);
  }

  return date;
}

/**
 * Преобразует UTC Date в ISO строку
 * @param date - Date объект в UTC
 * @returns ISO строка времени
 */
export function formatUTCToISO(date: Date): string {
  return date.toISOString();
}

/**
 * Валидирует что время находится в разумных пределах
 * @param date - Date объект для проверки
 * @returns true если время корректно
 */
export function validateTimeRange(date: Date): boolean {
  const now = new Date();
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  return date >= oneYearAgo && date <= oneYearFromNow;
}

/**
 * Проверяет что время не в прошлом (с учетом буфера)
 * @param date - Date объект для проверки
 * @param bufferMinutes - буфер в минутах (по умолчанию 30)
 * @returns true если время в будущем
 */
export function isFutureTime(date: Date, bufferMinutes: number = 30): boolean {
  const now = new Date();
  const bufferTime = new Date(now.getTime() + bufferMinutes * 60 * 1000);

  return date >= bufferTime;
}

/**
 * Добавляет минуты к UTC времени
 * @param date - базовое время в UTC
 * @param minutes - количество минут для добавления
 * @returns новое время в UTC
 */
export function addMinutesToUTC(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Вычисляет разность в минутах между двумя UTC временами
 * @param start - начальное время
 * @param end - конечное время
 * @returns разность в минутах
 */
export function getMinutesDifference(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Проверяет что время находится в рабочих часах
 * @param date - время для проверки
 * @param workStartHour - час начала работы (по умолчанию 9)
 * @param workEndHour - час окончания работы (по умолчанию 21)
 * @returns true если время в рабочих часах
 */
export function isWorkingHours(
  date: Date,
  workStartHour: number = 9,
  workEndHour: number = 21
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

/**
 * Получает начало дня в UTC
 * @param date - дата
 * @returns начало дня в UTC
 */
export function getStartOfDayUTC(date: Date): Date {
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  return startOfDay;
}

/**
 * Получает конец дня в UTC
 * @param date - дата
 * @returns конец дня в UTC
 */
export function getEndOfDayUTC(date: Date): Date {
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);
  return endOfDay;
}

/**
 * Форматирует время для отображения пользователю
 * @param date - время в UTC
 * @param timezone - часовой пояс (по умолчанию 'Europe/Moscow')
 * @returns отформатированная строка времени
 */
export function formatTimeForDisplay(
  date: Date,
  timezone: string = 'Europe/Moscow'
): string {
  try {
    return date.toLocaleString('ru-RU', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    // Fallback к UTC если часовой пояс не поддерживается
    return date.toISOString();
  }
}

/**
 * Создает Date объект из компонентов времени в UTC
 * @param year - год
 * @param month - месяц (1-12)
 * @param day - день
 * @param hour - час (0-23)
 * @param minute - минута (0-59)
 * @returns Date объект в UTC
 */
export function createUTCDate(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

/**
 * Проверяет что два времени не пересекаются
 * @param start1 - начало первого периода
 * @param end1 - конец первого периода
 * @param start2 - начало второго периода
 * @param end2 - конец второго периода
 * @returns true если периоды не пересекаются
 */
export function isTimeSlotsNonOverlapping(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return end1 <= start2 || end2 <= start1;
}

/**
 * Проверяет что время находится в допустимом диапазоне для записи
 * @param date - время для проверки
 * @param minAdvanceHours - минимальное время записи заранее в часах (по умолчанию 2)
 * @param maxAdvanceDays - максимальное время записи заранее в днях (по умолчанию 30)
 * @returns true если время допустимо для записи
 */
export function isValidBookingTime(
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
 * Получает текущее время в UTC
 * @returns текущее время в UTC
 */
export function getCurrentUTC(): Date {
  return new Date();
}

/**
 * Проверяет что время является валидным ISO строкой
 * @param isoString - строка для проверки
 * @returns true если строка валидна
 */
export function isValidISOString(isoString: string): boolean {
  try {
    const date = new Date(isoString);
    return (
      !isNaN(date.getTime()) &&
      isoString.includes('T') &&
      isoString.includes('Z')
    );
  } catch {
    return false;
  }
}

/**
 * Преобразует UTC время в локальное время мастера
 *
 * @param utcDate - Дата/время в UTC
 * @param timezone - Часовой пояс мастера (например, 'Europe/Moscow', 'America/New_York')
 * @returns Компоненты локального времени мастера
 */
export function convertUTCToMasterTZ(
  utcDate: Date,
  timezone: string
): {
  dateStr: string; // YYYY-MM-DD
  hour: number; // 0-23
  minute: number; // 0-59
  dayOfWeek: number; // 0-6 (0 = воскресенье)
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
    hour12: false,
  });

  const parts = formatter.formatToParts(utcDate);
  const year = parts.find(p => p.type === 'year')!.value;
  const month = parts.find(p => p.type === 'month')!.value;
  const day = parts.find(p => p.type === 'day')!.value;
  const hour = parseInt(parts.find(p => p.type === 'hour')!.value);
  const minute = parseInt(parts.find(p => p.type === 'minute')!.value);
  const weekday = parts.find(p => p.type === 'weekday')!.value;

  const dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  // Преобразуем день недели: Sunday = 0, Monday = 1, ..., Saturday = 6
  const weekdayMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  const dayOfWeek = weekdayMap[weekday] ?? 0;

  return { dateStr, hour, minute, dayOfWeek };
}

/**
 * Преобразует локальное время мастера в UTC
 *
 * @param dateStr - Дата в формате YYYY-MM-DD (в часовом поясе мастера)
 * @param timeStr - Время в формате HH:mm (в часовом поясе мастера)
 * @param timezone - Часовой пояс мастера (например, 'Europe/Moscow', 'America/New_York')
 * @returns Date объект в UTC
 */
export function convertMasterTZToUTC(
  dateStr: string,
  timeStr: string,
  timezone: string
): Date {
  // Парсим дату (YYYY-MM-DD)
  const [year, month, day] = dateStr.split('-').map(Number);

  // Парсим время (HH:mm)
  const [hours, minutes] = timeStr.split(':').map(Number);

  // Создаем строку даты и времени
  const dateTimeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

  // Используем итеративный подход для нахождения правильной UTC даты
  // Начинаем с предположения, что это UTC время
  let candidateUTC = new Date(dateTimeStr + 'Z');

  // Итеративно корректируем до тех пор, пока локальное время мастера не совпадет с желаемым
  for (let i = 0; i < 10; i++) {
    // Получаем локальное время мастера для этой UTC даты
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(candidateUTC);
    const masterHour = parseInt(parts.find(p => p.type === 'hour')!.value);
    const masterMinute = parseInt(parts.find(p => p.type === 'minute')!.value);

    // Вычисляем разницу в минутах
    const desiredMinutes = hours * 60 + minutes;
    const actualMinutes = masterHour * 60 + masterMinute;
    const diffMinutes = desiredMinutes - actualMinutes;

    // Если разница очень мала, возвращаем результат
    if (Math.abs(diffMinutes) < 1) {
      break;
    }

    // Корректируем UTC дату
    candidateUTC = new Date(candidateUTC.getTime() + diffMinutes * 60 * 1000);
  }

  return candidateUTC;
}
