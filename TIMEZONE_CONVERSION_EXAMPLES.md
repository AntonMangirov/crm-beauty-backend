# Примеры преобразований часовых поясов

## Обзор

Унифицированные утилиты `convertUTCToMasterTZ` и `convertMasterTZToUTC` обеспечивают правильное преобразование времени между UTC (хранится в БД) и локальным временем мастера.

## Утилиты

### `convertUTCToMasterTZ(utcDate, timezone)`

Преобразует UTC время в локальное время мастера.

**Параметры**:

- `utcDate: Date` - Дата/время в UTC
- `timezone: string` - Часовой пояс мастера (IANA timezone, например 'Europe/Moscow')

**Возвращает**:

```typescript
{
  dateStr: string; // YYYY-MM-DD
  hour: number; // 0-23
  minute: number; // 0-59
  dayOfWeek: number; // 0-6 (0 = воскресенье)
}
```

### `convertMasterTZToUTC(dateStr, timeStr, timezone)`

Преобразует локальное время мастера в UTC.

**Параметры**:

- `dateStr: string` - Дата в формате YYYY-MM-DD (в часовом поясе мастера)
- `timeStr: string` - Время в формате HH:mm (в часовом поясе мастера)
- `timezone: string` - Часовой пояс мастера

**Возвращает**: `Date` объект в UTC

## Примеры преобразований

### Пример 1: Europe/Moscow (UTC+3)

**Мастер в Москве, часовой пояс: `Europe/Moscow`**

#### Преобразование UTC → Москва

```typescript
// UTC время: 2024-01-15 10:00:00 UTC
const utcDate = new Date('2024-01-15T10:00:00.000Z');
const local = convertUTCToMasterTZ(utcDate, 'Europe/Moscow');

// Результат:
// {
//   dateStr: '2024-01-15',
//   hour: 13,      // 10:00 UTC = 13:00 MSK (UTC+3)
//   minute: 0,
//   dayOfWeek: 1   // Понедельник
// }
```

#### Преобразование Москва → UTC

```typescript
// Локальное время мастера: 2024-01-15 13:00 MSK
const utcDate = convertMasterTZToUTC('2024-01-15', '13:00', 'Europe/Moscow');

// Результат: Date('2024-01-15T10:00:00.000Z')
// 13:00 MSK = 10:00 UTC
```

#### Рабочие интервалы

```typescript
// Мастер работает: 09:00-18:00 MSK
const workStart = convertMasterTZToUTC('2024-01-15', '09:00', 'Europe/Moscow');
const workEnd = convertMasterTZToUTC('2024-01-15', '18:00', 'Europe/Moscow');

// Результат:
// workStart: Date('2024-01-15T06:00:00.000Z')  // 09:00 MSK = 06:00 UTC
// workEnd: Date('2024-01-15T15:00:00.000Z')    // 18:00 MSK = 15:00 UTC
```

---

### Пример 2: America/New_York (UTC-5 зимой, UTC-4 летом)

**Мастер в Нью-Йорке, часовой пояс: `America/New_York`**

#### Преобразование UTC → Нью-Йорк (зима, EST)

```typescript
// UTC время: 2024-01-15 10:00:00 UTC (зима)
const utcDate = new Date('2024-01-15T10:00:00.000Z');
const local = convertUTCToMasterTZ(utcDate, 'America/New_York');

// Результат:
// {
//   dateStr: '2024-01-15',
//   hour: 5,       // 10:00 UTC = 05:00 EST (UTC-5)
//   minute: 0,
//   dayOfWeek: 1
// }
```

#### Преобразование UTC → Нью-Йорк (лето, EDT)

```typescript
// UTC время: 2024-07-15 10:00:00 UTC (лето)
const utcDate = new Date('2024-07-15T10:00:00.000Z');
const local = convertUTCToMasterTZ(utcDate, 'America/New_York');

// Результат:
// {
//   dateStr: '2024-07-15',
//   hour: 6,       // 10:00 UTC = 06:00 EDT (UTC-4)
//   minute: 0,
//   dayOfWeek: 1
// }
```

#### Преобразование Нью-Йорк → UTC

```typescript
// Локальное время мастера: 2024-01-15 09:00 EST
const utcDate = convertMasterTZToUTC('2024-01-15', '09:00', 'America/New_York');

// Результат: Date('2024-01-15T14:00:00.000Z')
// 09:00 EST = 14:00 UTC
```

---

### Пример 3: Asia/Tokyo (UTC+9)

**Мастер в Токио, часовой пояс: `Asia/Tokyo`**

#### Преобразование UTC → Токио

```typescript
// UTC время: 2024-01-15 10:00:00 UTC
const utcDate = new Date('2024-01-15T10:00:00.000Z');
const local = convertUTCToMasterTZ(utcDate, 'Asia/Tokyo');

// Результат:
// {
//   dateStr: '2024-01-15',
//   hour: 19,      // 10:00 UTC = 19:00 JST (UTC+9)
//   minute: 0,
//   dayOfWeek: 1
// }
```

#### Преобразование Токио → UTC

```typescript
// Локальное время мастера: 2024-01-15 09:00 JST
const utcDate = convertMasterTZToUTC('2024-01-15', '09:00', 'Asia/Tokyo');

// Результат: Date('2024-01-15T00:00:00.000Z')
// 09:00 JST = 00:00 UTC
```

---

### Пример 4: Europe/London (UTC+0 зимой, UTC+1 летом)

**Мастер в Лондоне, часовой пояс: `Europe/London`**

#### Преобразование UTC → Лондон (зима, GMT)

```typescript
// UTC время: 2024-01-15 10:00:00 UTC (зима)
const utcDate = new Date('2024-01-15T10:00:00.000Z');
const local = convertUTCToMasterTZ(utcDate, 'Europe/London');

// Результат:
// {
//   dateStr: '2024-01-15',
//   hour: 10,      // 10:00 UTC = 10:00 GMT (UTC+0)
//   minute: 0,
//   dayOfWeek: 1
// }
```

#### Преобразование UTC → Лондон (лето, BST)

```typescript
// UTC время: 2024-07-15 10:00:00 UTC (лето)
const utcDate = new Date('2024-07-15T10:00:00.000Z');
const local = convertUTCToMasterTZ(utcDate, 'Europe/London');

// Результат:
// {
//   dateStr: '2024-07-15',
//   hour: 11,      // 10:00 UTC = 11:00 BST (UTC+1)
//   minute: 0,
//   dayOfWeek: 1
// }
```

---

## Использование в коде

### Генерация слотов

```typescript
// Мастер работает 09:00-18:00 в своем часовом поясе
const workIntervals = [{ start: '09:00', end: '18:00' }];

// Преобразуем в UTC для сравнения с бронированиями
for (const interval of workIntervals) {
  const workStartUTC = convertMasterTZToUTC(
    '2024-01-15',
    interval.start,
    'Europe/Moscow'
  );
  const workEndUTC = convertMasterTZToUTC(
    '2024-01-15',
    interval.end,
    'Europe/Moscow'
  );

  // workStartUTC и workEndUTC используются для генерации слотов
}
```

### Валидация бронирования

```typescript
// Клиент хочет записаться на 2024-01-15T10:00:00.000Z (UTC)
const bookingTimeUTC = new Date('2024-01-15T10:00:00.000Z');

// Преобразуем в локальное время мастера для проверки расписания
const { dateStr, hour, minute } = convertUTCToMasterTZ(
  bookingTimeUTC,
  'Europe/Moscow'
);

// Проверяем, что время попадает в рабочие интервалы
// hour = 13 (10:00 UTC = 13:00 MSK)
// Проверяем: 13:00 >= 09:00 && 13:00 < 18:00 ✅
```

### Определение дня недели

```typescript
// UTC время: 2024-01-15T22:00:00.000Z (понедельник в UTC)
const utcDate = new Date('2024-01-15T22:00:00.000Z');

// Для мастера в Токио (UTC+9)
const { dayOfWeek } = convertUTCToMasterTZ(utcDate, 'Asia/Tokyo');
// dayOfWeek = 2 (вторник, так как в Токио уже следующий день)

// Для мастера в Нью-Йорке (UTC-5)
const { dayOfWeek: dayOfWeekNY } = convertUTCToMasterTZ(
  utcDate,
  'America/New_York'
);
// dayOfWeekNY = 1 (понедельник, так как в Нью-Йорке еще тот же день)
```

---

## Важные моменты

### 1. В БД хранится только UTC

```typescript
// ✅ Правильно: сохраняем в БД UTC
const appointment = {
  startAt: new Date('2024-01-15T10:00:00.000Z'), // UTC
  endAt: new Date('2024-01-15T11:00:00.000Z'), // UTC
};

// ❌ Неправильно: НЕ сохраняем локальное время
const appointmentWrong = {
  startAt: '2024-01-15T13:00:00', // Локальное время MSK
};
```

### 2. Рабочие интервалы сравниваются в локальном TZ мастера

```typescript
// Мастер работает 09:00-18:00 MSK
const workIntervals = [{ start: '09:00', end: '18:00' }];

// Бронирование: 2024-01-15T10:00:00.000Z (UTC)
const bookingUTC = new Date('2024-01-15T10:00:00.000Z');

// Преобразуем в локальное время мастера
const { dateStr, hour } = convertUTCToMasterTZ(bookingUTC, 'Europe/Moscow');
// hour = 13 (10:00 UTC = 13:00 MSK)

// Сравниваем с рабочими интервалами
const isValid = hour >= 9 && hour < 18; // 13 >= 9 && 13 < 18 ✅
```

### 3. Перерывы также в локальном TZ мастера

```typescript
// Перерыв мастера: 13:00-14:00 MSK
const breaks = [{ start: '13:00', end: '14:00' }];

// Бронирование: 2024-01-15T10:00:00.000Z (UTC)
const bookingUTC = new Date('2024-01-15T10:00:00.000Z');

// Преобразуем в локальное время мастера
const { dateStr, hour } = convertUTCToMasterTZ(bookingUTC, 'Europe/Moscow');
// hour = 13

// Проверяем перерыв
const isOnBreak = hour >= 13 && hour < 14; // ✅ Попадает на перерыв
```

---

## Таблица смещений для популярных часовых поясов

| Часовой пояс          | Зимнее время | Летнее время | Пример города |
| --------------------- | ------------ | ------------ | ------------- |
| `Europe/Moscow`       | UTC+3        | UTC+3        | Москва        |
| `Europe/London`       | UTC+0        | UTC+1        | Лондон        |
| `America/New_York`    | UTC-5        | UTC-4        | Нью-Йорк      |
| `America/Los_Angeles` | UTC-8        | UTC-7        | Лос-Анджелес  |
| `Asia/Tokyo`          | UTC+9        | UTC+9        | Токио         |
| `Asia/Dubai`          | UTC+4        | UTC+4        | Дубай         |
| `Australia/Sydney`    | UTC+10       | UTC+11       | Сидней        |

---

## Резюме

1. ✅ **В БД хранится только UTC** - все `Date` объекты в UTC
2. ✅ **Рабочие интервалы в локальном TZ мастера** - `09:00-18:00` означает локальное время мастера
3. ✅ **Преобразования через утилиты** - всегда используем `convertUTCToMasterTZ` и `convertMasterTZToUTC`
4. ✅ **Автоматический учет DST** - утилиты учитывают переход на летнее/зимнее время
5. ✅ **Правильное определение дня недели** - день недели определяется в часовом поясе мастера


