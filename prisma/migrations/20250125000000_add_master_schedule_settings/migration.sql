-- Добавление новых полей для расписания работы и настроек слотов мастера
-- Все поля опциональные для обратной совместимости

-- Расписание работы: JSONB массив объектов { dayOfWeek: number, intervals: [{ from: string, to: string }] }
-- dayOfWeek: 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
-- from/to: время в формате "HH:mm" (например, "09:00", "18:00")
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workSchedule" JSONB;

-- Перерывы мастера: JSONB массив объектов { from: string, to: string, reason?: string }
-- from/to: время в формате "HH:mm"
-- reason: опциональная причина перерыва
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "breaks" JSONB;

-- Буфер после услуги по умолчанию (минуты)
-- Используется если у услуги не указан свой буфер
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultBufferMinutes" INTEGER DEFAULT 15;

-- Шаг генерации слотов (минуты): 5, 10, 15
-- Определяет интервал между возможными временами начала записи
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "slotStepMinutes" INTEGER DEFAULT 15;

-- Комментарий: Все новые поля имеют значения по умолчанию или NULL
-- workSchedule = NULL (мастер может настроить позже)
-- breaks = NULL (мастер может настроить позже)
-- defaultBufferMinutes = 15 (значение по умолчанию)
-- slotStepMinutes = 15 (значение по умолчанию)


