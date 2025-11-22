import multer from 'multer';
import { Request } from 'express';

// Настройка multer для обработки файлов в памяти
const storage = multer.memoryStorage();

// Фильтр для проверки типа файла
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Разрешаем только изображения
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Только изображения разрешены'));
  }
};

// Настройка multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB максимум
  },
});
