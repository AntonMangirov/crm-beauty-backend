# Быстрый старт для тестирования

## Локальное тестирование БЕЗ Cloudinary

**Вам НЕ нужно регистрироваться в Cloudinary!** Система работает в локальном режиме по умолчанию.

### 1. Установите только multer (без Cloudinary):

```bash
cd crm-beauty-backend
npm install multer
npm install --save-dev @types/multer
```

### 2. Убедитесь, что в `.env` НЕТ переменных Cloudinary

Или добавьте:
```env
UPLOAD_MODE=local
```

### 3. Запустите сервер:

```bash
npm run dev
```

### 4. Готово!

- Файлы будут сохраняться в папку `uploads/`
- Доступны по URL: `http://localhost:3000/uploads/filename.jpg`
- Статические файлы автоматически раздаются через Express

## Что происходит:

1. При загрузке фото файл сохраняется в `uploads/` папку
2. В БД сохраняется относительный URL: `/uploads/filename.jpg`
3. Express автоматически раздает файлы из папки `uploads/`
4. Frontend получает полный URL: `http://localhost:3000/uploads/filename.jpg`

## Переключение на Cloudinary (опционально):

Если хотите использовать Cloudinary:

1. Зарегистрируйтесь на https://cloudinary.com (бесплатно)
2. Добавьте в `.env`:
   ```env
   UPLOAD_MODE=cloudinary
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```
3. Установите пакет: `npm install cloudinary`
4. Перезапустите сервер

## Тестирование:

1. Войдите в кабинет мастера: `http://localhost:5173/master`
2. Нажмите "Редактировать профиль"
3. Нажмите "Загрузить фото"
4. Выберите изображение
5. Фото загрузится и отобразится!


