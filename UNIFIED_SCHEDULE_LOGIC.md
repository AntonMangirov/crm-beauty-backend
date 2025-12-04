# Унифицированная логика расчета слотов и валидации

## Обзор

Создана единая функция `getMasterDailySchedule`, которая устраняет дублирование логики и гарантирует, что алгоритм генерации слотов и валидация бронирования используют одинаковые настройки мастера для конкретной даты.

## Проблема

Ранее логика получения расписания мастера дублировалась в двух местах:

- `getTimeslots` - для генерации доступных слотов
- `bookPublicSlot` - для валидации времени бронирования

Это приводило к ситуации, когда:

- Алгоритм слотов мог разрешить время на основе одних настроек
- Валидация могла отклонить это же время на основе других настроек

## Решение

### Новая функция: `getMasterDailySchedule`

**Расположение**: `src/utils/slotCalculator.ts`

**Сигнатура**:

```typescript
export function getMasterDailySchedule(
  master: MasterWithSchedule,
  date: Date | string,
  timezone: string = 'Europe/Moscow',
  minServiceDurationMinutes: number = 15
): MasterSettings;
```

**Что делает**:

1. Принимает мастера с настройками из БД и дату
2. Определяет день недели **в часовом поясе мастера** (не UTC!)
3. Извлекает рабочие интервалы для этого дня из `workSchedule`
4. Преобразует перерывы из `breaks`
5. Применяет fallback значения для настроек
6. Возвращает единую структуру `MasterSettings`

**Важно**: День недели определяется в часовом поясе мастера, что гарантирует правильное сопоставление с расписанием.

## Схема вызовов

### 1. Генерация доступных слотов (`getTimeslots`)

```
GET /api/public/:slug/timeslots
  ↓
getTimeslots(req, res)
  ↓
getMasterDailySchedule(master, targetDateStr, timezone, minServiceDuration)
  ↓
calculateAvailableSlots(date, serviceIds, masterSettings, existingBookings, servicesInfo)
  ↓
Возвращает массив доступных слотов
```

**Код**:

```typescript
const masterSettings = getMasterDailySchedule(
  master,
  targetDateStr,
  timezone,
  minServiceDuration
);
const availableSlots = calculateAvailableSlots(
  targetDateStr,
  serviceIds,
  masterSettings,
  existingBookings,
  servicesInfo
);
```

### 2. Валидация бронирования (`bookPublicSlot`)

```
POST /api/public/:slug/book
  ↓
bookPublicSlot(req, res)
  ↓
getMasterDailySchedule(master, start, timezone, service.durationMin)
  ↓
isValidBookingTimeForMaster(masterSettings, start, duration)
  ↓
Возвращает { ok: true } или { ok: false, reason: string }
```

**Код**:

```typescript
const masterSettings = getMasterDailySchedule(
  master,
  start,
  timezone,
  service.durationMin
);
const validationResult = isValidBookingTimeForMaster(
  masterSettings,
  start,
  duration
);
```

## Преимущества

1. **Единый источник истины**: Все настройки мастера получаются через одну функцию
2. **Консистентность**: Алгоритм слотов и валидация используют одинаковые настройки
3. **Правильный часовой пояс**: День недели определяется в часовом поясе мастера
4. **Упрощение кода**: Убрано ~50 строк дублирующегося кода
5. **Легкость поддержки**: Изменения в логике расписания делаются в одном месте

## Структура данных

### MasterWithSchedule (входные данные)

```typescript
interface MasterWithSchedule {
  workSchedule: unknown; // JSON из БД
  breaks: unknown; // JSON из БД
  defaultBufferMinutes: number | null;
  slotStepMinutes: number | null;
}
```

### MasterSettings (выходные данные)

```typescript
interface MasterSettings {
  workIntervals: WorkInterval[]; // Рабочие интервалы для дня
  breaks: Break[]; // Перерывы
  serviceBufferMinutes: number; // Буфер после услуги
  slotStepMinutes: number; // Шаг генерации слотов
  minServiceDurationMinutes: number; // Минимальная длительность для анти-простоя
  timezone: string; // Часовой пояс мастера
  autoBuffer?: boolean; // Автоматический межуслуговой буфер
}
```

## Fallback значения

Если мастер не настроил расписание:

- `workIntervals`: `[{ start: '09:00', end: '18:00' }]`
- `breaks`: `[]`
- `serviceBufferMinutes`: `15`
- `slotStepMinutes`: `15`
- `autoBuffer`: `false`

## Измененные файлы

1. `src/utils/slotCalculator.ts`
   - Добавлен интерфейс `MasterWithSchedule`
   - Добавлена функция `getMasterDailySchedule`

2. `src/controllers/publicController.ts`
   - `getTimeslots`: использует `getMasterDailySchedule`
   - `bookPublicSlot`: использует `getMasterDailySchedule`
   - Удалены дублирующиеся импорты `WorkInterval`, `Break`

## Тестирование

Для проверки консистентности:

1. Сгенерировать слоты через `getTimeslots`
2. Попробовать забронировать один из слотов через `bookPublicSlot`
3. Бронирование должно пройти успешно (если слот не занят)

## Миграция

Изменения обратно совместимы:

- Старые функции `calculateAvailableSlots` и `isValidBookingTimeForMaster` не изменены
- Они по-прежнему принимают `MasterSettings` как параметр
- Изменились только места создания `MasterSettings` - теперь через единую функцию








