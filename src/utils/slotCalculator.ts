/**
 * Умный алгоритм генерации доступных временных слотов
 * Реализует логику выбора времени как в YClients/Fresha
 */

import { addMinutesToUTC, getMinutesDifference } from './timeUtils';

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
 * Преобразует локальное время (HH:mm) в UTC Date для указанной даты
 * Использует правильное преобразование с учетом часового пояса мастера
 */
function localTimeToUTC(
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
    const breakStart = localTimeToUTC(dateStr, breakItem.start, timezone);
    const breakEnd = localTimeToUTC(dateStr, breakItem.end, timezone);
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
    const workStart = localTimeToUTC(date, workInterval.start, timezone);
    const workEnd = localTimeToUTC(date, workInterval.end, timezone);

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
