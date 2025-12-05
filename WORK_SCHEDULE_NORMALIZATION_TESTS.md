# Тестовые кейсы для нормализации workSchedule

## Обзор

Функции `normalizeWorkSchedule` и `normalizeBreaks` защищают от некорректных данных в БД и гарантируют, что система всегда работает с валидными расписаниями.

## Тестовые кейсы для normalizeWorkSchedule

### ✅ Кейс 1: Валидное расписание

**Входные данные**:

```json
[
  {
    "dayOfWeek": 1,
    "intervals": [
      { "from": "09:00", "to": "13:00" },
      { "from": "14:00", "to": "18:00" }
    ]
  },
  {
    "dayOfWeek": 2,
    "intervals": [{ "from": "09:00", "to": "18:00" }]
  }
]
```

**Ожидаемый результат**: Расписание возвращается без изменений

**Код**:

```typescript
const schedule = normalizeWorkSchedule(validSchedule);
expect(schedule).toEqual(validSchedule);
```

---

### ❌ Кейс 2: Не массив

**Входные данные**:

```typescript
null
// или
"not an array"
// или
{ dayOfWeek: 1, intervals: [...] }
```

**Ожидаемый результат**: `null`

**Код**:

```typescript
expect(normalizeWorkSchedule(null)).toBeNull();
expect(normalizeWorkSchedule('not an array')).toBeNull();
expect(normalizeWorkSchedule({ dayOfWeek: 1 })).toBeNull();
```

---

### ❌ Кейс 3: Некорректная структура дня

**Входные данные**:

```json
[
  { "dayOfWeek": 1, "intervals": [...] },  // валидный
  { "intervals": [...] },                  // нет dayOfWeek
  { "dayOfWeek": "1" },                    // dayOfWeek не число
  { "dayOfWeek": 1 },                      // нет intervals
  null                                      // null элемент
]
```

**Ожидаемый результат**: Только первый день (валидный) включен в результат

**Код**:

```typescript
const schedule = normalizeWorkSchedule([
  { dayOfWeek: 1, intervals: [{ from: '09:00', to: '18:00' }] },
  { intervals: [{ from: '09:00', to: '18:00' }] },
  { dayOfWeek: '1' },
  { dayOfWeek: 1 },
  null,
]);
expect(schedule).toEqual([
  { dayOfWeek: 1, intervals: [{ from: '09:00', to: '18:00' }] },
]);
```

---

### ❌ Кейс 4: dayOfWeek вне диапазона

**Входные данные**:

```json
[
  { "dayOfWeek": -1, "intervals": [...] },
  { "dayOfWeek": 7, "intervals": [...] },
  { "dayOfWeek": 1.5, "intervals": [...] },
  { "dayOfWeek": 1, "intervals": [...] }  // валидный
]
```

**Ожидаемый результат**: Только валидный день (dayOfWeek: 1) включен

**Код**:

```typescript
const schedule = normalizeWorkSchedule([
  { dayOfWeek: -1, intervals: [{ from: '09:00', to: '18:00' }] },
  { dayOfWeek: 7, intervals: [{ from: '09:00', to: '18:00' }] },
  { dayOfWeek: 1.5, intervals: [{ from: '09:00', to: '18:00' }] },
  { dayOfWeek: 1, intervals: [{ from: '09:00', to: '18:00' }] },
]);
expect(schedule).toEqual([
  { dayOfWeek: 1, intervals: [{ from: '09:00', to: '18:00' }] },
]);
```

---

### ❌ Кейс 5: intervals не массив

**Входные данные**:

```json
[
  { "dayOfWeek": 1, "intervals": "not an array" },
  { "dayOfWeek": 1, "intervals": null },
  { "dayOfWeek": 1, "intervals": [{ "from": "09:00", "to": "18:00" }] } // валидный
]
```

**Ожидаемый результат**: Только день с валидными intervals включен

**Код**:

```typescript
const schedule = normalizeWorkSchedule([
  { dayOfWeek: 1, intervals: 'not an array' },
  { dayOfWeek: 1, intervals: null },
  { dayOfWeek: 1, intervals: [{ from: '09:00', to: '18:00' }] },
]);
expect(schedule).toEqual([
  { dayOfWeek: 1, intervals: [{ from: '09:00', to: '18:00' }] },
]);
```

---

### ❌ Кейс 6: Некорректный формат времени

**Входные данные**:

```json
[
  {
    "dayOfWeek": 1,
    "intervals": [
      { "from": "9:00", "to": "18:00" }, // нет ведущего нуля
      { "from": "09:00", "to": "18:00" }, // валидный
      { "from": "25:00", "to": "18:00" }, // час > 23
      { "from": "09:60", "to": "18:00" }, // минута >= 60
      { "from": "09:00", "to": "invalid" }, // невалидный формат
      { "from": "09:00", "to": "18:00" } // валидный
    ]
  }
]
```

**Ожидаемый результат**: Только интервалы с валидным форматом времени включены

**Код**:

```typescript
const schedule = normalizeWorkSchedule([
  {
    dayOfWeek: 1,
    intervals: [
      { from: '9:00', to: '18:00' },
      { from: '09:00', to: '18:00' },
      { from: '25:00', to: '18:00' },
      { from: '09:60', to: '18:00' },
      { from: '09:00', to: 'invalid' },
      { from: '09:00', to: '18:00' },
    ],
  },
]);
expect(schedule).toEqual([
  {
    dayOfWeek: 1,
    intervals: [
      { from: '09:00', to: '18:00' },
      { from: '09:00', to: '18:00' },
    ],
  },
]);
```

---

### ❌ Кейс 7: from >= to (некорректный интервал)

**Входные данные**:

```json
[
  {
    "dayOfWeek": 1,
    "intervals": [
      { "from": "18:00", "to": "09:00" }, // from > to
      { "from": "09:00", "to": "09:00" }, // from == to
      { "from": "09:00", "to": "18:00" }, // валидный
      { "from": "14:00", "to": "13:00" } // from > to
    ]
  }
]
```

**Ожидаемый результат**: Только валидные интервалы (from < to) включены

**Код**:

```typescript
const schedule = normalizeWorkSchedule([
  {
    dayOfWeek: 1,
    intervals: [
      { from: '18:00', to: '09:00' },
      { from: '09:00', to: '09:00' },
      { from: '09:00', to: '18:00' },
      { from: '14:00', to: '13:00' },
    ],
  },
]);
expect(schedule).toEqual([
  {
    dayOfWeek: 1,
    intervals: [{ from: '09:00', to: '18:00' }],
  },
]);
```

---

### ❌ Кейс 8: Некорректная структура интервала

**Входные данные**:

```json
[
  {
    "dayOfWeek": 1,
    "intervals": [
      { "from": "09:00" }, // нет to
      { "to": "18:00" }, // нет from
      { "from": 900, "to": 1800 }, // числа вместо строк
      { "from": "09:00", "to": "18:00" }, // валидный
      null, // null элемент
      "not an object" // строка вместо объекта
    ]
  }
]
```

**Ожидаемый результат**: Только валидный интервал включен

**Код**:

```typescript
const schedule = normalizeWorkSchedule([
  {
    dayOfWeek: 1,
    intervals: [
      { from: '09:00' },
      { to: '18:00' },
      { from: 900, to: 1800 },
      { from: '09:00', to: '18:00' },
      null,
      'not an object',
    ],
  },
]);
expect(schedule).toEqual([
  {
    dayOfWeek: 1,
    intervals: [{ from: '09:00', to: '18:00' }],
  },
]);
```

---

### ❌ Кейс 9: Пустое расписание после фильтрации

**Входные данные**:

```json
[
  { "dayOfWeek": 1, "intervals": [] }, // пустые интервалы
  { "dayOfWeek": 2, "intervals": [{ "from": "18:00", "to": "09:00" }] } // все интервалы невалидны
]
```

**Ожидаемый результат**: `null` (fallback к дефолтному расписанию)

**Код**:

```typescript
expect(
  normalizeWorkSchedule([
    { dayOfWeek: 1, intervals: [] },
    { dayOfWeek: 2, intervals: [{ from: '18:00', to: '09:00' }] },
  ])
).toBeNull();
```

---

### ✅ Кейс 10: Частично валидное расписание

**Входные данные**:

```json
[
  { "dayOfWeek": 1, "intervals": [{ "from": "09:00", "to": "18:00" }] }, // валидный
  { "dayOfWeek": 2, "intervals": [{ "from": "invalid", "to": "18:00" }] }, // невалидный интервал
  {
    "dayOfWeek": 3,
    "intervals": [
      { "from": "09:00", "to": "13:00" },
      { "from": "14:00", "to": "18:00" }
    ]
  } // валидный
]
```

**Ожидаемый результат**: Только дни с валидными интервалами включены

**Код**:

```typescript
const schedule = normalizeWorkSchedule([
  { dayOfWeek: 1, intervals: [{ from: '09:00', to: '18:00' }] },
  { dayOfWeek: 2, intervals: [{ from: 'invalid', to: '18:00' }] },
  {
    dayOfWeek: 3,
    intervals: [
      { from: '09:00', to: '13:00' },
      { from: '14:00', to: '18:00' },
    ],
  },
]);
expect(schedule).toEqual([
  { dayOfWeek: 1, intervals: [{ from: '09:00', to: '18:00' }] },
  {
    dayOfWeek: 3,
    intervals: [
      { from: '09:00', to: '13:00' },
      { from: '14:00', to: '18:00' },
    ],
  },
]);
```

---

## Тестовые кейсы для normalizeBreaks

### ✅ Кейс 1: Валидные перерывы

**Входные данные**:

```json
[
  { "from": "13:00", "to": "14:00", "reason": "Обед" },
  { "from": "15:30", "to": "15:45" }
]
```

**Ожидаемый результат**: Все перерывы возвращаются (reason игнорируется)

**Код**:

```typescript
const breaks = normalizeBreaks([
  { from: '13:00', to: '14:00', reason: 'Обед' },
  { from: '15:30', to: '15:45' },
]);
expect(breaks).toEqual([
  { from: '13:00', to: '14:00' },
  { from: '15:30', to: '15:45' },
]);
```

---

### ❌ Кейс 2: Не массив

**Входные данные**:

```typescript
null
// или
"not an array"
// или
{ from: "13:00", to: "14:00" }
```

**Ожидаемый результат**: Пустой массив `[]`

**Код**:

```typescript
expect(normalizeBreaks(null)).toEqual([]);
expect(normalizeBreaks('not an array')).toEqual([]);
expect(normalizeBreaks({ from: '13:00', to: '14:00' })).toEqual([]);
```

---

### ❌ Кейс 3: Некорректная структура перерыва

**Входные данные**:

```json
[
  { "from": "13:00", "to": "14:00" }, // валидный
  { "from": "13:00" }, // нет to
  { "to": "14:00" }, // нет from
  { "from": 1300, "to": 1400 }, // числа вместо строк
  null, // null элемент
  "not an object" // строка вместо объекта
]
```

**Ожидаемый результат**: Только валидные перерывы включены

**Код**:

```typescript
const breaks = normalizeBreaks([
  { from: '13:00', to: '14:00' },
  { from: '13:00' },
  { to: '14:00' },
  { from: 1300, to: 1400 },
  null,
  'not an object',
]);
expect(breaks).toEqual([{ from: '13:00', to: '14:00' }]);
```

---

### ❌ Кейс 4: Некорректный формат времени

**Входные данные**:

```json
[
  { "from": "9:00", "to": "14:00" }, // нет ведущего нуля
  { "from": "13:00", "to": "14:00" }, // валидный
  { "from": "25:00", "to": "14:00" }, // час > 23
  { "from": "13:60", "to": "14:00" }, // минута >= 60
  { "from": "13:00", "to": "invalid" } // невалидный формат
]
```

**Ожидаемый результат**: Только перерывы с валидным форматом времени включены

**Код**:

```typescript
const breaks = normalizeBreaks([
  { from: '9:00', to: '14:00' },
  { from: '13:00', to: '14:00' },
  { from: '25:00', to: '14:00' },
  { from: '13:60', to: '14:00' },
  { from: '13:00', to: 'invalid' },
]);
expect(breaks).toEqual([{ from: '13:00', to: '14:00' }]);
```

---

### ❌ Кейс 5: from >= to

**Входные данные**:

```json
[
  { "from": "14:00", "to": "13:00" }, // from > to
  { "from": "13:00", "to": "13:00" }, // from == to
  { "from": "13:00", "to": "14:00" } // валидный
]
```

**Ожидаемый результат**: Только валидные перерывы (from < to) включены

**Код**:

```typescript
const breaks = normalizeBreaks([
  { from: '14:00', to: '13:00' },
  { from: '13:00', to: '13:00' },
  { from: '13:00', to: '14:00' },
]);
expect(breaks).toEqual([{ from: '13:00', to: '14:00' }]);
```

---

## Интеграционные тесты

### Тест: getMasterDailySchedule с некорректными данными

**Сценарий**: Мастер имеет некорректные данные в БД

**Входные данные**:

```typescript
const master = {
  workSchedule: [
    { dayOfWeek: 1, intervals: [{ from: '18:00', to: '09:00' }] }, // невалидный интервал
    { dayOfWeek: 2, intervals: [{ from: '09:00', to: '18:00' }] }, // валидный
  ],
  breaks: [
    { from: '14:00', to: '13:00' }, // невалидный перерыв
    { from: '15:00', to: '16:00' }, // валидный
  ],
  defaultBufferMinutes: 15,
  slotStepMinutes: 15,
};
```

**Ожидаемый результат**:

- Для дня недели 1: используется fallback `[{ start: '09:00', end: '18:00' }]` (нет валидных интервалов)
- Для дня недели 2: используется расписание из БД `[{ start: '09:00', end: '18:00' }]`
- Перерывы: только валидный `[{ start: '15:00', end: '16:00' }]`

**Код**:

```typescript
// Для дня недели 1 (понедельник)
const settings1 = getMasterDailySchedule(
  master,
  new Date('2024-01-15'),
  'Europe/Moscow'
);
expect(settings1.workIntervals).toEqual([{ start: '09:00', end: '18:00' }]); // fallback
expect(settings1.breaks).toEqual([{ start: '15:00', end: '16:00' }]);

// Для дня недели 2 (вторник)
const settings2 = getMasterDailySchedule(
  master,
  new Date('2024-01-16'),
  'Europe/Moscow'
);
expect(settings2.workIntervals).toEqual([{ start: '09:00', end: '18:00' }]); // из БД
expect(settings2.breaks).toEqual([{ start: '15:00', end: '16:00' }]);
```

---

## Резюме

Функции нормализации гарантируют:

1. ✅ **Безопасность**: Система не упадет на некорректных данных
2. ✅ **Консистентность**: Всегда возвращаются валидные данные или fallback
3. ✅ **Фильтрация**: Некорректные данные автоматически отбрасываются
4. ✅ **Валидация**: Проверяется формат времени, структура данных, логика интервалов

Fallback значения:

- `workSchedule`: `[{ start: '09:00', end: '18:00' }]` (если нет валидных данных)
- `breaks`: `[]` (если нет валидных данных)












