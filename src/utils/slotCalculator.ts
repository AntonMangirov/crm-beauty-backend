/**
 * Умный алгоритм генерации доступных временных слотов
 * Реализует логику выбора времени как в YClients/Fresha
 */

import {
  addMinutesToUTC,
  getMinutesDifference,
  convertUTCToMasterTZ,
  convertMasterTZToUTC,
  getCurrentTimeInTimezone,
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
  slotCompression?: boolean; // Сжатие последовательных слотов (показывать только первый и последний)
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
 * Функция сжатия слотов: группирует последовательные слоты и показывает только первый и последний
 * Это уменьшает количество отображаемых слотов в UI, улучшая UX
 */
export function compressSlots(
  slotsISO: string[],
  slotStepMinutes: number
): string[] {
  if (!slotsISO || slotsISO.length <= 2) return slotsISO;

  const slots = slotsISO
    .map(s => new Date(s))
    .sort((a, b) => a.getTime() - b.getTime());
  const clusters: Date[][] = [];
  let currentCluster: Date[] = [slots[0]];

  for (let i = 1; i < slots.length; i++) {
    const prev = slots[i - 1];
    const curr = slots[i];
    const diffMinutes = (curr.getTime() - prev.getTime()) / 60000;

    if (Math.abs(diffMinutes - slotStepMinutes) < 0.0001) {
      currentCluster.push(curr);
    } else {
      clusters.push(currentCluster);
      currentCluster = [curr];
    }
  }
  clusters.push(currentCluster);

  const resultDates: Date[] = [];
  for (const cluster of clusters) {
    if (cluster.length === 1) {
      resultDates.push(cluster[0]);
    } else {
      // Первый и последний слот в кластере
      resultDates.push(cluster[0]);
      resultDates.push(cluster[cluster.length - 1]);
    }
  }

  // Уникальность и сортировка
  const uniqueIso = Array.from(new Set(resultDates.map(d => d.toISOString())));
  uniqueIso.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return uniqueIso;
}

/**
 * Округляет время вверх до ближайшего шага слота
 * Исправленная версия с более точным округлением
 */
export function roundUpToSlotStep(date: Date, slotStepMinutes: number): Date {
  const d = new Date(date.getTime());
  // Используем UTC-based вычисления чтобы избежать смешения локальных и UTC минут
  const minutes = d.getUTCMinutes();
  const remainder = minutes % slotStepMinutes;

  if (remainder !== 0) {
    d.setUTCMinutes(minutes + (slotStepMinutes - remainder));
  }

  // Очищаем секунды и миллисекунды
  d.setUTCSeconds(0);
  d.setUTCMilliseconds(0);

  // Если округление подняло минуты >= 60, Date корректно перенесёт час автоматически
  return d;
}

/**
 * Проверяет, пересекается ли интервал с перерывами
 */
function breaksOverlapOnUTC(
  breaks: Break[],
  dateStr: string,
  timezone: string,
  start: Date,
  end: Date
): boolean {
  for (const br of breaks) {
    const brStart = convertMasterTZToUTC(dateStr, br.start, timezone).getTime();
    const brEnd = convertMasterTZToUTC(dateStr, br.end, timezone).getTime();
    if (!(end.getTime() <= brStart || start.getTime() >= brEnd)) {
      return true;
    }
  }
  return false;
}

/**
 * Объединяет и сортирует занятые интервалы (bookings + breaks + auto buffers)
 * Улучшенная версия: учитывает перерывы при авто-буфере (не расширяет через breaks)
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

  // 1) Бронирования с буферами (по услуге или общему)
  const bookingsWithBuffers: Array<{ start: Date; end: Date }> = [];

  for (const booking of bookings) {
    const bookingStart = new Date(booking.start);
    let bookingEnd = new Date(booking.end);

    // Буфер для этой услуги (приоритет: service.bufferMinutes -> master.serviceBufferMinutes)
    let bufferMinutes = masterSettings.serviceBufferMinutes;
    if (booking.serviceId) {
      const service = servicesInfo.find(s => s.id === booking.serviceId);
      if (service && service.bufferMinutes !== undefined) {
        bufferMinutes = service.bufferMinutes;
      }
    }

    bookingEnd = addMinutesToUTC(bookingEnd, bufferMinutes);
    bookingsWithBuffers.push({ start: bookingStart, end: bookingEnd });
  }

  // Сортировка
  bookingsWithBuffers.sort((a, b) => a.start.getTime() - b.start.getTime());

  // 2) Авто-буфер: добавляем аккуратно, не "поглощая" перерывы
  if (masterSettings.autoBuffer) {
    const autoBufferMinutes = masterSettings.serviceBufferMinutes;
    const withAuto: Array<{ start: Date; end: Date }> = [];

    for (let i = 0; i < bookingsWithBuffers.length; i++) {
      const current = bookingsWithBuffers[i];
      withAuto.push({
        start: new Date(current.start),
        end: new Date(current.end),
      });

      if (i < bookingsWithBuffers.length - 1) {
        const next = bookingsWithBuffers[i + 1];
        const gap = getMinutesDifference(current.end, next.start);

        if (gap > 0 && gap < autoBufferMinutes) {
          // Расширяем текущий до начала следующего (но не через break)
          // Если между current.end и next.start есть break -> не расширяем через break
          const wouldStart = current.end;
          const wouldEnd = next.start;

          if (
            breaksOverlapOnUTC(breaks, dateStr, timezone, wouldStart, wouldEnd)
          ) {
            // Есть break — не расширяем через break; оставляем gap как есть
            // Ничего не делаем
          } else {
            // Безопасно расширяем до начала следующего бронирования
            withAuto[withAuto.length - 1].end = new Date(next.start.getTime());
          }
        } else if (gap >= autoBufferMinutes) {
          // Пытаемся вставить авто-буфер, но проверяем пересечение с break
          const autoStart = current.end;
          const autoEnd = addMinutesToUTC(autoStart, autoBufferMinutes);

          if (
            !breaksOverlapOnUTC(
              breaks,
              dateStr,
              timezone,
              autoStart,
              autoEnd
            ) &&
            autoEnd <= next.start
          ) {
            withAuto.push({ start: autoStart, end: autoEnd });
          } else {
            // Буфер пересекает break или следующий booking -> не вставляем буфер
            // Можно оставить gap как есть
          }
        }
      }
    }

    // Заменяем
    bookingsWithBuffers.length = 0;
    bookingsWithBuffers.push(...withAuto);
    bookingsWithBuffers.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  // Добавляем в общий список
  intervals.push(...bookingsWithBuffers);

  // 3) Перерывы мастера как busy-intervals (переводим в UTC)
  for (const br of breaks) {
    const brStart = convertMasterTZToUTC(dateStr, br.start, timezone);
    const brEnd = convertMasterTZToUTC(dateStr, br.end, timezone);
    intervals.push({ start: brStart, end: brEnd });
  }

  // Сортируем и объединяем пересекающиеся
  intervals.sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: Array<{ start: Date; end: Date }> = [];
  for (const interval of intervals) {
    if (merged.length === 0) {
      merged.push({
        start: new Date(interval.start),
        end: new Date(interval.end),
      });
    } else {
      const last = merged[merged.length - 1];
      if (interval.start.getTime() <= last.end.getTime()) {
        // Объединяем
        last.end = new Date(
          Math.max(last.end.getTime(), interval.end.getTime())
        );
      } else {
        merged.push({
          start: new Date(interval.start),
          end: new Date(interval.end),
        });
      }
    }
  }

  return merged;
}

/**
 * Вычитает занятые интервалы из рабочего времени
 * Улучшенная версия с более точной обработкой границ
 */
function subtractBusyIntervals(
  workStart: Date,
  workEnd: Date,
  busyIntervals: Array<{ start: Date; end: Date }>
): Array<{ start: Date; end: Date }> {
  const freeIntervals: Array<{ start: Date; end: Date }> = [];
  let currentStart = new Date(workStart.getTime());

  for (const busy of busyIntervals) {
    if (busy.end.getTime() <= currentStart.getTime()) {
      // Занятый интервал полностью до текущего старта — пропускаем
      continue;
    }

    if (busy.start.getTime() > currentStart.getTime()) {
      const freeEnd = new Date(
        Math.min(busy.start.getTime(), workEnd.getTime())
      );
      if (freeEnd.getTime() > currentStart.getTime()) {
        freeIntervals.push({
          start: new Date(currentStart),
          end: freeEnd,
        });
      }
    }

    // Сдвигаем текущий старт
    currentStart = new Date(
      Math.max(currentStart.getTime(), busy.end.getTime())
    );

    if (currentStart.getTime() >= workEnd.getTime()) {
      break;
    }
  }

  if (currentStart.getTime() < workEnd.getTime()) {
    freeIntervals.push({
      start: new Date(currentStart),
      end: new Date(workEnd),
    });
  }

  return freeIntervals;
}

/**
 * Вспомогательная функция: генерация слотов для одного сервиса (используется в fallback)
 */
function generateSlotsForService(
  dateStr: string,
  svcTotalDuration: number,
  masterSettings: MasterSettings,
  existingBookings: ExistingBooking[],
  servicesInfo: ServiceInfo[]
): string[] {
  const {
    workIntervals,
    breaks,
    slotStepMinutes,
    timezone,
    minServiceDurationMinutes,
  } = masterSettings;
  const now = new Date();
  const availableSlots: string[] = [];

  // Если нет интервалов — пусто
  if (!workIntervals || workIntervals.length === 0) return [];

  // Конвертируем существующие busyIntervals
  const busyIntervals = mergeBusyIntervals(
    existingBookings,
    breaks,
    dateStr,
    timezone,
    masterSettings,
    servicesInfo
  );

  for (const workInterval of workIntervals) {
    const workStart = convertMasterTZToUTC(
      dateStr,
      workInterval.start,
      timezone
    );
    const workEnd = convertMasterTZToUTC(dateStr, workInterval.end, timezone);

    if (workEnd.getTime() <= now.getTime()) continue;

    const freeIntervals = subtractBusyIntervals(
      workStart,
      workEnd,
      busyIntervals
    );

    for (const freeInterval of freeIntervals) {
      const freeStart = freeInterval.start;
      const freeEnd = freeInterval.end;

      const effectiveStart = new Date(
        Math.max(freeStart.getTime(), now.getTime())
      );
      let slotStart = roundUpToSlotStep(effectiveStart, slotStepMinutes);

      if (slotStart.getTime() < freeStart.getTime())
        slotStart = roundUpToSlotStep(freeStart, slotStepMinutes);

      if (slotStart.getTime() < now.getTime()) {
        const roundedNow = roundUpToSlotStep(now, slotStepMinutes);
        slotStart =
          roundedNow.getTime() > freeStart.getTime()
            ? roundedNow
            : roundUpToSlotStep(freeStart, slotStepMinutes);
      }

      while (slotStart.getTime() < freeEnd.getTime()) {
        if (slotStart.getTime() < freeStart.getTime()) {
          slotStart = addMinutesToUTC(slotStart, slotStepMinutes);
          continue;
        }

        const slotEnd = addMinutesToUTC(slotStart, svcTotalDuration);

        if (slotEnd.getTime() > freeEnd.getTime()) break;

        // Tail check: tail must be 0 or >= minServiceDurationMinutes
        const tailDuration = getMinutesDifference(slotEnd, freeEnd);

        if (tailDuration > 0 && tailDuration < minServiceDurationMinutes) {
          slotStart = addMinutesToUTC(slotStart, slotStepMinutes);
          continue;
        }

        // Overlap check
        let overlap = false;
        for (const busy of busyIntervals) {
          if (intervalsOverlap(slotStart, slotEnd, busy.start, busy.end)) {
            overlap = true;
            break;
          }
        }

        if (!overlap) availableSlots.push(slotStart.toISOString());

        slotStart = addMinutesToUTC(slotStart, slotStepMinutes);
      }
    }
  }

  availableSlots.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return availableSlots;
}

/**
 * Вычисляет доступные временные слоты
 * Улучшенная версия с fallback по услугам и компрессией слотов
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
    slotCompression,
  } = masterSettings;

  if (!workIntervals || workIntervals.length === 0) return [];

  // Вычисляем maxServiceDuration и maxTotalDuration для переданных serviceIds
  let maxServiceDuration = 0;
  let maxTotalDuration = 0;

  for (const serviceId of serviceIds) {
    const service = servicesInfo.find(s => s.id === serviceId);
    if (service) {
      const buffer = service.bufferMinutes ?? serviceBufferMinutes;
      const totalDuration = service.durationMin + buffer;
      maxServiceDuration = Math.max(maxServiceDuration, service.durationMin);
      maxTotalDuration = Math.max(maxTotalDuration, totalDuration);
    }
  }

  // Если не заданы конкретные services (например, список пуст) — берем conservative defaults
  if (maxTotalDuration === 0) {
    maxServiceDuration = minServiceDurationMinutes;
    maxTotalDuration = maxServiceDuration + serviceBufferMinutes;
  }

  const busyIntervals = mergeBusyIntervals(
    existingBookings,
    breaks,
    date,
    timezone,
    masterSettings,
    servicesInfo
  );

  const availableSlots: string[] = [];

  // Определяем текущее время для сравнения
  // Все слоты хранятся в UTC, поэтому сравниваем с текущим UTC временем
  const nowUTC = new Date();

  // Проверяем, запрашивается ли сегодняшняя дата в часовом поясе мастера
  const { dateStr: todayInMasterTZ } = convertUTCToMasterTZ(nowUTC, timezone);
  const isToday = date === todayInMasterTZ;

  // Для сегодняшней даты используем текущее UTC время напрямую
  // Это правильно, так как все слоты уже в UTC
  const now = nowUTC;

  // Дополнительная проверка: если date не совпадает с todayInMasterTZ, но это может быть сегодня
  // в другом часовом поясе, проверяем через сравнение дат в UTC
  // Это нужно для случаев, когда date приходит в формате UTC, а не в часовом поясе мастера
  const dateInUTC = new Date(date + 'T00:00:00.000Z');
  const todayInUTC = new Date(
    nowUTC.toISOString().split('T')[0] + 'T00:00:00.000Z'
  );
  const isTodayByUTC = dateInUTC.getTime() === todayInUTC.getTime();

  // Используем более строгую проверку: либо по часовому поясу мастера, либо по UTC
  const isTodayFinal = isToday || isTodayByUTC;

  // Отладочная информация (можно убрать после проверки)
  // console.log('DEBUG calculateAvailableSlots:', {
  //   date,
  //   todayInMasterTZ,
  //   isToday,
  //   nowUTC: nowUTC.toISOString(),
  //   timezone,
  // });

  for (const workInterval of workIntervals) {
    const workStart = convertMasterTZToUTC(date, workInterval.start, timezone);
    const workEnd = convertMasterTZToUTC(date, workInterval.end, timezone);

    // Пропускаем рабочие интервалы, которые уже закончились
    if (workEnd.getTime() <= now.getTime()) continue;

    // Для сегодняшней даты: если рабочий интервал еще не начался (workStart > now),
    // это нормально - мы начнем генерацию с workStart, который в будущем
    // Но если workStart < now, значит рабочий день уже начался, и мы должны начать с now
    // Это обрабатывается дальше в коде при генерации слотов

    // Отладочная информация (можно убрать после проверки)
    // if (isToday) {
    //   console.log('DEBUG workInterval:', {
    //     workInterval: `${workInterval.start}-${workInterval.end}`,
    //     workStartUTC: workStart.toISOString(),
    //     workEndUTC: workEnd.toISOString(),
    //     nowUTC: now.toISOString(),
    //     workStartAfterNow: workStart.getTime() > now.getTime(),
    //   });
    // }

    const freeIntervals = subtractBusyIntervals(
      workStart,
      workEnd,
      busyIntervals
    );

    for (const freeInterval of freeIntervals) {
      const freeStart = freeInterval.start;
      const freeEnd = freeInterval.end;

      // Определяем начальную точку для генерации слотов
      // Для сегодняшней даты: используем максимум из начала свободного интервала и текущего времени
      // Для будущих дат: используем начало свободного интервала
      let effectiveStart = freeStart;
      if (isTodayFinal) {
        // Для сегодняшней даты начинаем с текущего времени, если свободный интервал начался раньше
        effectiveStart = new Date(Math.max(freeStart.getTime(), now.getTime()));
      }

      // Округляем до шага слота
      let slotStart = roundUpToSlotStep(effectiveStart, slotStepMinutes);

      // Для сегодняшней даты: критически важно - слот не должен быть в прошлом
      // Проверяем это ДО проверки freeStart, чтобы не перезаписать правильное время
      if (isTodayFinal) {
        // Если слот в прошлом, используем округленное текущее время
        if (slotStart.getTime() < now.getTime()) {
          const roundedNow = roundUpToSlotStep(now, slotStepMinutes);
          // Используем максимум из округленного текущего времени и начала свободного интервала
          slotStart = new Date(
            Math.max(roundedNow.getTime(), freeStart.getTime())
          );
        }
        // Финальная проверка: если слот все еще в прошлом, пропускаем интервал
        if (slotStart.getTime() < now.getTime()) {
          continue;
        }
      }

      // Убеждаемся, что слот не раньше начала свободного интервала
      // (это может произойти после округления или корректировки для isTodayFinal)
      if (slotStart.getTime() < freeStart.getTime()) {
        slotStart = roundUpToSlotStep(freeStart, slotStepMinutes);
        // Для сегодняшней даты: если после этого слот в прошлом, пропускаем интервал
        if (isTodayFinal && slotStart.getTime() < now.getTime()) {
          continue;
        }
      }

      // Финальная проверка перед циклом: для сегодняшней даты слот не должен быть в прошлом
      if (isTodayFinal && slotStart.getTime() < now.getTime()) {
        continue;
      }

      while (slotStart.getTime() < freeEnd.getTime()) {
        // Убеждаемся, что слот не раньше начала свободного интервала
        if (slotStart.getTime() < freeStart.getTime()) {
          slotStart = addMinutesToUTC(slotStart, slotStepMinutes);
          continue;
        }

        // Для сегодняшней даты: критически важно - каждый слот проверяем на то, что он не в прошлом
        if (isTodayFinal && slotStart.getTime() < now.getTime()) {
          slotStart = addMinutesToUTC(slotStart, slotStepMinutes);
          continue;
        }

        // Конец слота = начало + maxTotalDuration (учитываем выбранные услуги)
        const slotEnd = addMinutesToUTC(slotStart, maxTotalDuration);

        if (slotEnd.getTime() > freeEnd.getTime()) {
          break;
        }

        // Улучшенная проверка хвоста: сравниваем с maxServiceDuration (более корректно)
        const tailDuration = getMinutesDifference(slotEnd, freeEnd);

        if (tailDuration > 0 && tailDuration < maxServiceDuration) {
          slotStart = addMinutesToUTC(slotStart, slotStepMinutes);
          continue;
        }

        // Проверяем пересечение с busyIntervals
        let isOverlapping = false;
        for (const busy of busyIntervals) {
          if (intervalsOverlap(slotStart, slotEnd, busy.start, busy.end)) {
            isOverlapping = true;
            break;
          }
        }

        if (!isOverlapping) {
          availableSlots.push(slotStart.toISOString());
        }

        slotStart = addMinutesToUTC(slotStart, slotStepMinutes);
      }
    }
  }

  // Сортируем
  availableSlots.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // Если не найдено слотов для набора услуг, пробуем fallback: слоты по отдельным услугам
  if (availableSlots.length === 0 && servicesInfo && servicesInfo.length > 0) {
    const alternativePerService: Record<string, string[]> = {};

    for (const svc of servicesInfo) {
      const buf = svc.bufferMinutes ?? serviceBufferMinutes;
      const svcTotal = svc.durationMin + buf;
      const svcSlots = generateSlotsForService(
        date,
        svcTotal,
        masterSettings,
        existingBookings,
        servicesInfo
      );

      if (svcSlots.length > 0) {
        alternativePerService[svc.id] = svcSlots;
      }
    }

    // Если есть альтернативы — отдаём альтернативные слоты для одной из услуг
    const firstAltServiceId = Object.keys(alternativePerService)[0];
    if (firstAltServiceId) {
      const alt = alternativePerService[firstAltServiceId];
      if (alt && alt.length > 0) {
        // Применим компрессию если включена
        const finalAlt = slotCompression
          ? compressSlots(alt, slotStepMinutes)
          : alt;
        return finalAlt;
      }
    }
  }

  // Применяем компрессию слотов, если включена
  if (slotCompression) {
    return compressSlots(availableSlots, slotStepMinutes);
  }

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

  // TODO: Получить slotCompression из настроек мастера в БД
  // Пока используем значение по умолчанию false
  const slotCompression = false;

  return {
    workIntervals,
    breaks,
    serviceBufferMinutes,
    slotStepMinutes,
    minServiceDurationMinutes,
    timezone,
    autoBuffer,
    slotCompression,
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

  // Получаем локальные компоненты времени мастера
  const { dateStr } = convertUTCToMasterTZ(startTimeUTC, timezone);
  const { dateStr: todayInMasterTZ } = convertUTCToMasterTZ(
    new Date(),
    timezone
  );

  // Проверяем, что время не в прошлом
  // Если запрашивается сегодняшняя дата, используем текущее время в часовом поясе мастера
  let now: Date;
  if (dateStr === todayInMasterTZ) {
    // Для сегодняшней даты используем текущее время в часовом поясе мастера
    now = getCurrentTimeInTimezone(timezone);
  } else {
    // Для будущих дат используем UTC время (это не критично, так как дата в будущем)
    now = new Date();
  }

  if (startTimeUTC.getTime() <= now.getTime()) {
    return {
      ok: false,
      reason: 'Время записи не может быть в прошлом',
    };
  }

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
