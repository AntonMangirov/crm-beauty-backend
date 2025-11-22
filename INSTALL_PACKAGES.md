# Установка пакетов для загрузки изображений

## Необходимые пакеты

Выполните в директории `crm-beauty-backend`:

```bash
npm install cloudinary multer
npm install --save-dev @types/multer
```

## Переменные окружения

Добавьте в `.env`:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Получение учетных данных Cloudinary

1. Зарегистрируйтесь на https://cloudinary.com (бесплатный план доступен)
2. В Dashboard найдите:
   - Cloud name
   - API Key
   - API Secret
3. Добавьте их в `.env`

## Тестирование

После установки пакетов и настройки переменных окружения перезапустите backend сервер.

