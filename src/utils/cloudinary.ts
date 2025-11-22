import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import fs from 'fs/promises';
import path from 'path';

// Режим работы: 'cloudinary' или 'local'
const UPLOAD_MODE = process.env.UPLOAD_MODE || 'local';
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Создаем директорию для загрузок, если её нет
if (UPLOAD_MODE === 'local') {
  fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);
}

// Конфигурация Cloudinary (только если используется Cloudinary)
if (UPLOAD_MODE === 'cloudinary') {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Загружает изображение (в Cloudinary или локально)
 * @param buffer - буфер изображения
 * @param folder - папка (опционально)
 * @returns URL загруженного изображения
 */
export async function uploadImageToCloudinary(
  buffer: Buffer,
  folder: string = 'beauty-crm'
): Promise<string> {
  if (UPLOAD_MODE === 'local') {
    // Локальное хранилище
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 9);
    const filename = `${timestamp}-${randomStr}.jpg`;
    const filepath = path.join(UPLOADS_DIR, filename);

    await fs.writeFile(filepath, buffer);
    const url = `/uploads/${filename}`;
    console.log('[LOCAL UPLOAD] File saved:', url);
    return url;
  } else {
    // Cloudinary
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto' },
            { format: 'auto' },
          ],
        },
        (
          error: Error | undefined,
          result: { secure_url: string } | undefined
        ) => {
          if (error) {
            console.error('[CLOUDINARY] Upload error:', error);
            reject(error);
          } else if (result) {
            console.log('[CLOUDINARY] Upload successful:', result.secure_url);
            resolve(result.secure_url);
          } else {
            reject(new Error('Upload failed: no result'));
          }
        }
      );

      const readableStream = Readable.from(buffer);
      readableStream.pipe(uploadStream);
    });
  }
}

/**
 * Удаляет изображение (из Cloudinary или локально)
 * @param
 *   imageUrl - URL изображения
 */
export async function deleteImageFromCloudinary(
  imageUrl: string
): Promise<void> {
  try {
    if (UPLOAD_MODE === 'local') {
      // Локальное удаление
      if (imageUrl.startsWith('/uploads/')) {
        const filename = path.basename(imageUrl);
        const filepath = path.join(UPLOADS_DIR, filename);
        await fs.unlink(filepath).catch(() => {
          // Игнорируем ошибку если файл не найден
        });
        console.log('[LOCAL DELETE] File deleted:', filename);
      }
    } else {
      // Cloudinary удаление
      const urlParts = imageUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      const publicId = filename.split('.')[0];
      const folder = urlParts[urlParts.length - 2];

      const fullPublicId = folder ? `${folder}/${publicId}` : publicId;
      await cloudinary.uploader.destroy(fullPublicId);
      console.log('[CLOUDINARY] Deleted:', fullPublicId);
    }
  } catch (error) {
    console.error('[DELETE] Error:', error);
    // Не бросаем ошибку, чтобы не блокировать удаление записи
  }
}
