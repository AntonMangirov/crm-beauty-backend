/**
 * Умный алгоритм генерации доступных временных слотов
 * Реализует логику выбора времени как в YClients/Fresha
 */

import {
  addMinutesToUTC,
  getMinutesDifference,
  convertUTCToMasterTZ,
  convertMasterTZToUTC,
} from './timeUtils';

export interface WorkInterval {
  start: string; // Формат "HH:mm" в локальном времени мастера
  end: string; // Формат "HH:mm" в локальном времени мастера
}

export interface Break {
  start: string; // Формат "HH:mm" в локальном времени мастера
  end: string; // Формат "HH:mm" в локальном времени мастера
}

export interface MasterSettings {
  workIntervals: WorkInterval[];
  breaks: Break[];
  serviceBufferMinutes: number; // Буфер после услуги
  slotStepMinutes: number; // Шаг генерации слотов (5/10/15)
  minServiceDurationMinutes: number; // Минимальная длительность услуги для анти-простоя
  timezone: string; // Часовой пояс мастера (например, 'Europe/Moscow')
  autoBuffer?: boolean; // Автоматический межуслуговой буфер между любыми процедурами
}

export interface ExistingBooking {
  start: string; // ISO строка UTC
  end: string; // ISO строка UTC
  serviceId?: string; // ID услуги для определения буфера
}

export interface ServiceInfo {
  id: string;
  durationMin: number;
  bufferMinutes?: number; // Буфер конкретной услуги (если отличается от общего)
}

/**
 * Тип для мастера с настройками расписания (из БД)
 */
export interface MasterWithSchedule {
  workSchedule: unknown; // JSON из БД: Array<{ dayOfWeek: number, intervals: Array<{ from: string, to: string }> }>
  breaks: unknown; // JSON из БД: Array<{ from: string, to: string, reason?: string }>
  defaultBufferMinutes: number | null;
  slotStepMinutes: number | null;
}

/**
 * Проверяет, пересекаются ли два временных интервала
 */
function intervalsOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Округляет время вверх до ближайшего шага слота
 */
function roundUpToSlotStep(date: Date, slotStepMinutes: number): Date {
  const rounded = new Date(date);
  const minutes = rounded.getUTCMinutes();
  const roundedMinutes = Math.ceil(minutes / slotStepMinutes) * slotStepMinutes;

  rounded.setUTCMinutes(roundedMinutes);
  rounded.setUTCSeconds(0);
  rounded.setUTCMilliseconds(0);

  // Если минут >= 60, добавляем час и сбрасываем минуты
  if (rounded.getUTCMinutes() >= 60) {
    rounded.setUTCHours(rounded.getUTCHours() + 1);
    rounded.setUTCMinutes(0);
  }

  return rounded;
}

/**
 * Объединяет и сортирует занятые интервалы (bookings + breaks + auto buffers)
 */
function mergeBusyIntervals(
  bookings: ExistingBooking[],
  breaks: Break[],
  dateStr: string,
  timezone: string,
  masterSettings: MasterSettings,
  servicesInfo: ServiceInfo[]
): Array<{ start: Date; end: Date }> {
  const intervals: Array<{ start: Date; end: Date }> = [];

  // Обрабатываем существующие записи с учетом буферов
  const bookingsWithBuffers: Array<{ start: Date; end: Date }> = [];

  for (const booking of bookings) {
    const bookingStart = new Date(booking.start);
    let bookingEnd = new Date(booking.end);

    // Определяем буфер для этой услуги
    let bufferMinutes = masterSettings.serviceBufferMinutes;
    if (booking.serviceId) {
      const service = servicesInfo.find(s => s.id === booking.serviceId);
      if (service && service.bufferMinutes !== undefined) {
        bufferMinutes = service.bufferMinutes;
      }
    }

    // Добавляем буфер после услуги
    bookingEnd = addMinutesToUTC(bookingEnd, bufferMinutes);

    bookingsWithBuffers.push({
      start: bookingStart,
      end: bookingEnd,
    });
  }

  // Сортируем бронирования по времени начала
  bookingsWithBuffers.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Если включен автоматический межуслуговой буфер, добавляем буферы между бронированиями
  if (masterSettings.autoBuffer) {
    const autoBufferMinutes = masterSettings.serviceBufferMinutes;

    // Создаем новый массив с автоматическими буферами
    const bookingsWithAutoBuffers: Array<{ start: Date; end: Date }> = [];

    for (let i = 0; i < bookingsWithBuffers.length; i++) {
      const currentBooking = bookingsWithBuffers[i];

      // Добавляем текущее бронирование
      bookingsWithAutoBuffers.push({
        start: new Date(currentBooking.start),
        end: new Date(currentBooking.end),
      });

      // Если есть следующее бронирование, добавляем автоматический буфер между ними
      if (i < bookingsWithBuffers.length - 1) {
        const nextBooking = bookingsWithBuffers[i + 1];
        const gap = getMinutesDifference(currentBooking.end, nextBooking.start);

        // Если промежуток меньше автоматического буфера, расширяем текущее бронирование
        if (gap > 0 && gap < autoBufferMinutes) {
          // Расширяем конец текущего бронирования
          bookingsWithAutoBuffers[bookingsWithAutoBuffers.length - 1].end =
            new Date(nextBooking.start.getTime());
        } else if (gap >= autoBufferMinutes) {
          // Добавляем автоматический буфер между бронированиями
          const autoBufferStart = currentBooking.end;
          const autoBufferEnd = addMinutesToUTC(
            autoBufferStart,
            autoBufferMinutes
          );

          // Проверяем, что буфер не выходит за начало следующего бронирования
          if (autoBufferEnd <= nextBooking.start) {
            bookingsWithAutoBuffers.push({
              start: autoBufferStart,
              end: autoBufferEnd,
            });
          } else {
            // Если буфер пересекается со следующим бронированием, расширяем текущее
            bookingsWithAutoBuffers[bookingsWithAutoBuffers.length - 1].end =
              new Date(nextBooking.start.getTime());
          }
        }
      }
    }

    // Заменяем массив бронирований на версию с автоматическими буферами
    bookingsWithBuffers.length = 0;
    bookingsWithBuffers.push(...bookingsWithAutoBuffers);

    // Пересортировываем после добавления автоматических буферов
    bookingsWithBuffers.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  // Добавляем все бронирования с буферами в интервалы
  intervals.push(...bookingsWithBuffers);

  // Добавляем перерывы мастера
  for (const breakItem of breaks) {
    const breakStart = convertMasterTZToUTC(dateStr, breakItem.start, timezone);
    const breakEnd = convertMasterTZToUTC(dateStr, breakItem.end, timezone);
    intervals.push({ start: breakStart, end: breakEnd });
  }

  // Сортируем по времени начала
  intervals.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Объединяем пересекающиеся интервалы (включая перерывы и буферы)
  const merged: Array<{ start: Date; end: Date }> = [];
  for (const interval of intervals) {
    if (merged.length === 0) {
      merged.push(interval);
    } else {
      const last = merged[merged.length - 1];
      if (interval.start <= last.end) {
        // Пересекаются или соприкасаются - объединяем
        last.end = new Date(
          Math.max(last.end.getTime(), interval.end.getTime())
        );
      } else {
        merged.push(interval);
      }
    }
  }

  return merged;
}

/**
 * Вычитает занятые интервалы из рабочего времени
 */
function subtractBusyIntervals(
  workStart: Date,
  workEnd: Date,
  busyIntervals: Array<{ start: Date; end: Date }>
): Array<{ start: Date; end: Date }> {
  const freeIntervals: Array<{ start: Date; end: Date }> = [];
  let currentStart = workStart;

  for (const busy of busyIntervals) {
    // Если занятый интервал начинается после текущего начала
    if (busy.start > currentStart) {
      // Добавляем свободный интервал до начала занятого
      freeIntervals.push({
        start: currentStart,
        end: new Date(Math.min(busy.start.getTime(), workEnd.getTime())),
      });
    }
    // Обновляем текущее начало на конец занятого интервала
    currentStart = new Date(
      Math.max(currentStart.getTime(), busy.end.getTime())
    );

    // Если мы уже прошли конец рабочего дня
    if (currentStart >= workEnd) {
      break;
    }
  }

  // Добавляем оставшийся свободный интервал до конца рабочего дня
  if (currentStart < workEnd) {
    freeIntervals.push({ start: currentStart, end: workEnd });
  }

  return freeIntervals;
}

/**
 * Вычисляет доступные временные слоты
 *
 * @param date - Дата в формате YYYY-MM-DD
 * @param serviceIds - Массив ID услуг (для расчета максимальной длительности)
 * @param masterSettings - Настройки мастера
 * @param existingBookings - Существующие записи
 * @param servicesInfo - Информация об услугах (для получения длительности и буфера)
 * @returns Массив ISO строк с возможными стартовыми временами
 */
export function calculateAvailableSlots(
  date: string,
  serviceIds: string[],
  masterSettings: MasterSettings,
  existingBookings: ExistingBooking[],
  servicesInfo: ServiceInfo[]
): string[] {
  const {
    workIntervals,
    breaks,
    serviceBufferMinutes,
    slotStepMinutes,
    minServiceDurationMinutes,
    timezone,
  } = masterSettings;

  // Если нет рабочих интервалов, возвращаем пустой массив
  if (workIntervals.length === 0) {
    return [];
  }

  // Вычисляем максимальную длительность услуги + буфер
  let maxServiceDuration = 0;
  let maxTotalDuration = 0; // длительность + буфер

  for (const serviceId of serviceIds) {
    const service = servicesInfo.find(s => s.id === serviceId);
    if (service) {
      const buffer = service.bufferMinutes ?? serviceBufferMinutes;
      const totalDuration = service.durationMin + buffer;
      maxServiceDuration = Math.max(maxServiceDuration, service.durationMin);
      maxTotalDuration = Math.max(maxTotalDuration, totalDuration);
    }
  }

  // Если услуги не найдены, используем минимальные значения
  if (maxTotalDuration === 0) {
    maxServiceDuration = minServiceDurationMinutes;
    maxTotalDuration = maxServiceDuration + serviceBufferMinutes;
  }

  const availableSlots: string[] = [];
  const now = new Date();

  // Обрабатываем каждый рабочий интервал
  for (const workInterval of workIntervals) {
    const workStart = convertMasterTZToUTC(date, workInterval.start, timezone);
    const workEnd = convertMasterTZToUTC(date, workInterval.end, timezone);

    // Если рабочий интервал в прошлом, пропускаем
    if (workEnd <= now) {
      continue;
    }

    // Объединяем занятые интервалы (bookings + breaks + auto buffers)
    const busyIntervals = mergeBusyIntervals(
      existingBookings,
      breaks,
      date,
      timezone,
      masterSettings,
      servicesInfo
    );

    // Вычитаем занятые интервалы из рабочего времени
    const freeIntervals = subtractBusyIntervals(
      workStart,
      workEnd,
      busyIntervals
    );

    // Генерируем слоты для каждого свободного интервала
    for (const freeInterval of freeIntervals) {
      const freeStart = freeInterval.start;
      const freeEnd = freeInterval.end;

      // Начинаем генерацию с начала свободного интервала или текущего времени (что больше)
      const effectiveStart = new Date(
        Math.max(freeStart.getTime(), now.getTime())
      );

      // Округляем вверх до ближайшего шага слота
      let slotStart = roundUpToSlotStep(effectiveStart, slotStepMinutes);

      // Убеждаемся, что слот не раньше начала свободного интервала
      if (slotStart < freeStart) {
        slotStart = roundUpToSlotStep(freeStart, slotStepMinutes);
      }

      // Убеждаемся, что слот не в прошлом
      if (slotStart < now) {
        const roundedNow = roundUpToSlotStep(now, slotStepMinutes);
        // Используем максимум из округленного текущего времени и начала свободного интервала
        slotStart =
          roundedNow > freeStart
            ? roundedNow
            : roundUpToSlotStep(freeStart, slotStepMinutes);
      }

      // Генерируем слоты с шагом slotStepMinutes
      while (slotStart < freeEnd) {
        // Проверяем, что слот не начинается раньше начала свободного интервала
        if (slotStart < freeStart) {
          slotStart = addMinutesToUTC(slotStart, slotStepMinutes);
          continue;
        }

        // Вычисляем конец слота (начало + длительность + буфер)
        const slotEnd = addMinutesToUTC(slotStart, maxTotalDuration);

        // Проверяем, что весь слот помещается в свободный интервал
        if (slotEnd > freeEnd) {
          break; // Больше слотов не поместится
        }

        // Анти-простой: проверяем хвост после слота
        const tailStart = slotEnd;
        const tailEnd = freeEnd;
        const tailDuration = getMinutesDifference(tailStart, tailEnd);

        // Разрешаем пустые хвосты только == 0 или >= минимальной услуги
        if (tailDuration > 0 && tailDuration < minServiceDurationMinutes) {
          // Хвост слишком маленький - пропускаем этот слот
          slotStart = addMinutesToUTC(slotStart, slotStepMinutes);
          continue;
        }

        // Проверяем, что слот не пересекается с занятыми интервалами
        let isOverlapping = false;
        for (const busy of busyIntervals) {
          if (intervalsOverlap(slotStart, slotEnd, busy.start, busy.end)) {
            isOverlapping = true;
            break;
          }
        }

        if (!isOverlapping) {
          // Слот доступен
          availableSlots.push(slotStart.toISOString());
        }

        // Переходим к следующему слоту
        slotStart = addMinutesToUTC(slotStart, slotStepMinutes);
      }
    }
  }

  // Сортируем слоты по времени
  availableSlots.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return availableSlots;
}

/**
 * Проверяет, что строка соответствует формату времени HH:mm
 */
function isValidTimeFormat(time: string): boolean {
  if (typeof time !== 'string') {
    return false;
  }
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Преобразует время в минуты для сравнения
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Проверяет, что интервал валиден (from < to)
 */
function isValidInterval(from: string, to: string): boolean {
  if (!isValidTimeFormat(from) || !isValidTimeFormat(to)) {
    return false;
  }
  return timeToMinutes(from) < timeToMinutes(to);
}

/**
 * Нормализует и валидирует workSchedule из БД
 *
 * @param rawSchedule - Сырые данные workSchedule из БД (может быть любым типом)
 * @returns Нормализованное расписание или null если данные невалидны
 */
export function normalizeWorkSchedule(rawSchedule: unknown): Array<{
  dayOfWeek: number;
  intervals: Array<{ from: string; to: string }>;
}> | null {
  // Если данные отсутствуют или не объект
  if (!rawSchedule || typeof rawSchedule !== 'object') {
    return null;
  }

  // Проверяем, что это массив
  if (!Array.isArray(rawSchedule)) {
    return null;
  }

  // Нормализуем каждый день недели
  const normalizedSchedule: Array<{
    dayOfWeek: number;
    intervals: Array<{ from: string; to: string }>;
  }> = [];

  for (const daySchedule of rawSchedule) {
    // Проверяем структуру дня
    if (
      !daySchedule ||
      typeof daySchedule !== 'object' ||
      typeof daySchedule.dayOfWeek !== 'number'
    ) {
      continue; // Пропускаем некорректный день
    }

    const dayOfWeek = daySchedule.dayOfWeek;

    // Проверяем, что dayOfWeek в допустимом диапазоне (0-6)
    if (dayOfWeek < 0 || dayOfWeek > 6 || !Number.isInteger(dayOfWeek)) {
      continue; // Пропускаем некорректный день недели
    }

    // Проверяем наличие intervals
    if (!daySchedule.intervals || !Array.isArray(daySchedule.intervals)) {
      continue; // Пропускаем день без интервалов
    }

    // Нормализуем интервалы
    const normalizedIntervals: Array<{ from: string; to: string }> = [];

    for (const interval of daySchedule.intervals) {
      // Проверяем структуру интервала
      if (
        !interval ||
        typeof interval !== 'object' ||
        typeof interval.from !== 'string' ||
        typeof interval.to !== 'string'
      ) {
        continue; // Пропускаем некорректный интервал
      }

      const { from, to } = interval;

      // Проверяем формат времени и корректность интервала
      if (isValidInterval(from, to)) {
        normalizedIntervals.push({ from, to });
      }
      // Иначе пропускаем некорректный интервал
    }

    // Добавляем день только если есть хотя бы один валидный интервал
    if (normalizedIntervals.length > 0) {
      normalizedSchedule.push({
        dayOfWeek,
        intervals: normalizedIntervals,
      });
    }
  }

  // Возвращаем null если не осталось валидных дней
  return normalizedSchedule.length > 0 ? normalizedSchedule : null;
}

/**
 * Нормализует и валидирует breaks из БД
 *
 * @param rawBreaks - Сырые данные breaks из БД (может быть любым типом)
 * @returns Нормализованные перерывы или пустой массив если данные невалидны
 */
export function normalizeBreaks(
  rawBreaks: unknown
): Array<{ from: string; to: string }> {
  // Если данные отсутствуют или не объект
  if (!rawBreaks || typeof rawBreaks !== 'object') {
    return [];
  }

  // Проверяем, что это массив
  if (!Array.isArray(rawBreaks)) {
    return [];
  }

  // Нормализуем перерывы
  const normalizedBreaks: Array<{ from: string; to: string }> = [];

  for (const breakItem of rawBreaks) {
    // Проверяем структуру перерыва
    if (
      !breakItem ||
      typeof breakItem !== 'object' ||
      typeof breakItem.from !== 'string' ||
      typeof breakItem.to !== 'string'
    ) {
      continue; // Пропускаем некорректный перерыв
    }

    const { from, to } = breakItem;

    // Проверяем формат времени и корректность интервала
    if (isValidInterval(from, to)) {
      normalizedBreaks.push({ from, to });
    }
    // Иначе пропускаем некорректный перерыв
  }

  return normalizedBreaks;
}

/**
 * Получает расписание мастера для конкретной даты
 *
 * @param master - Мастер с настройками расписания из БД
 * @param date - Дата (Date объект или строка YYYY-MM-DD)
 * @param timezone - Часовой пояс мастера (по умолчанию 'Europe/Moscow')
 * @param minServiceDurationMinutes - Минимальная длительность услуги для анти-простоя (по умолчанию 15)
 * @returns Настройки мастера для указанной даты
 */
export function getMasterDailySchedule(
  master: MasterWithSchedule,
  date: Date | string,
  timezone: string = 'Europe/Moscow',
  minServiceDurationMinutes: number = 15
): MasterSettings {
  // Преобразуем дату в Date объект, если это строка
  const dateObj =
    typeof date === 'string' ? new Date(date + 'T00:00:00.000Z') : date;

  // Получаем день недели в часовом поясе мастера
  const { dayOfWeek } = convertUTCToMasterTZ(dateObj, timezone);

  // Нормализуем и валидируем workSchedule
  const normalizedSchedule = normalizeWorkSchedule(master.workSchedule);

  // Преобразуем workSchedule в workIntervals для конкретной даты
  let workIntervals: WorkInterval[] = [];
  if (normalizedSchedule) {
    // Ищем расписание для текущего дня недели
    const daySchedule = normalizedSchedule.find(s => s.dayOfWeek === dayOfWeek);
    if (daySchedule && daySchedule.intervals) {
      workIntervals = daySchedule.intervals.map(interval => ({
        start: interval.from,
        end: interval.to,
      }));
    }
  }

  // Если workSchedule = null или не найден для этого дня → используем fallback
  if (workIntervals.length === 0) {
    workIntervals = [{ start: '09:00', end: '18:00' }];
  }

  // Нормализуем и валидируем breaks
  const normalizedBreaks = normalizeBreaks(master.breaks);
  const breaks: Break[] = normalizedBreaks.map(breakItem => ({
    start: breakItem.from,
    end: breakItem.to,
  }));

  // Получаем настройки с fallback значениями
  const serviceBufferMinutes = master.defaultBufferMinutes ?? 15;
  const slotStepMinutes = master.slotStepMinutes ?? 15;

  // TODO: Получить autoBuffer из настроек мастера в БД
  // Пока используем значение по умолчанию false
  const autoBuffer = false;

  return {
    workIntervals,
    breaks,
    serviceBufferMinutes,
    slotStepMinutes,
    minServiceDurationMinutes,
    timezone,
    autoBuffer,
  };
}

/**
 * Валидирует время бронирования для мастера с учетом его расписания
 *
 * @param masterSettings - Настройки мастера (расписание, перерывы, буфер и т.д.)
 * @param startTimeUTC - Время начала записи в UTC
 * @param serviceDurationMinutes - Длительность услуги в минутах
 * @param serviceBufferMinutes - Буфер услуги (опционально, если не указан, используется из masterSettings)
 * @returns Результат валидации: { ok: true } или { ok: false, reason: string }
 */
export function isValidBookingTimeForMaster(
  masterSettings: MasterSettings,
  startTimeUTC: Date,
  serviceDurationMinutes: number,
  serviceBufferMinutes?: number
): { ok: true } | { ok: false; reason: string } {
  const {
    workIntervals,
    breaks,
    serviceBufferMinutes: defaultBufferMinutes,
    timezone,
  } = masterSettings;

  // Проверяем, что время не в прошлом
  const now = new Date();
  if (startTimeUTC <= now) {
    return {
      ok: false,
      reason: 'Время записи не может быть в прошлом',
    };
  }

  // Получаем локальные компоненты времени мастера
  const { dateStr } = convertUTCToMasterTZ(startTimeUTC, timezone);

  // Проверяем, что день - рабочий (есть рабочие интервалы для этого дня)
  if (workIntervals.length === 0) {
    return {
      ok: false,
      reason: 'Мастер не работает в этот день',
    };
  }

  // Вычисляем конец услуги (начало + длительность + буфер)
  const bufferMinutes = serviceBufferMinutes ?? defaultBufferMinutes;
  const serviceEndUTC = addMinutesToUTC(
    startTimeUTC,
    serviceDurationMinutes + bufferMinutes
  );

  // Проверяем, что услуга помещается в рабочие интервалы
  let fitsInWorkInterval = false;
  for (const workInterval of workIntervals) {
    const workStartUTC = convertMasterTZToUTC(
      dateStr,
      workInterval.start,
      timezone
    );
    const workEndUTC = convertMasterTZToUTC(
      dateStr,
      workInterval.end,
      timezone
    );

    // Проверяем, что начало услуги внутри рабочего интервала
    if (startTimeUTC < workStartUTC || startTimeUTC >= workEndUTC) {
      continue;
    }

    // Проверяем, что конец услуги (с буфером) тоже внутри рабочего интервала
    if (serviceEndUTC <= workEndUTC) {
      fitsInWorkInterval = true;
      break;
    }
  }

  if (!fitsInWorkInterval) {
    return {
      ok: false,
      reason: 'Время записи не попадает в рабочие часы мастера',
    };
  }

  // Проверяем перерывы
  for (const breakItem of breaks) {
    const breakStartUTC = convertMasterTZToUTC(
      dateStr,
      breakItem.start,
      timezone
    );
    const breakEndUTC = convertMasterTZToUTC(dateStr, breakItem.end, timezone);

    // Проверяем, что услуга не пересекается с перерывом
    if (
      intervalsOverlap(startTimeUTC, serviceEndUTC, breakStartUTC, breakEndUTC)
    ) {
      return {
        ok: false,
        reason: 'Время записи попадает на перерыв мастера',
      };
    }
  }

  // Все проверки пройдены
  return { ok: true };
}
