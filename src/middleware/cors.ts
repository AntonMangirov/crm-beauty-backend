import cors from 'cors';
import { Request, Response } from 'express';

// Разрешенные origins для production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:8080',
  // Добавьте ваши production домены здесь
  // 'https://yourdomain.com',
  // 'https://www.yourdomain.com',
];

// Разрешенные origins для development
const devOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
];

// Функция для проверки origin
/* eslint-disable no-unused-vars */
const originCheck = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  /* eslint-enable no-unused-vars */
  // Разрешаем запросы без origin (например, Postman, мобильные приложения)
  if (!origin) {
    console.log('CORS: Request without origin, allowing');
    return callback(null, true);
  }

  const isDevelopment = process.env.NODE_ENV !== 'production';
  const allowedList = isDevelopment
    ? [...allowedOrigins, ...devOrigins]
    : allowedOrigins;

  console.log(
    `CORS: Checking origin: ${origin}, allowed: ${allowedList.join(', ')}`
  );

  if (allowedList.includes(origin)) {
    console.log(`CORS: Origin ${origin} is allowed`);
    return callback(null, true);
  }

  // Логируем заблокированные origins для мониторинга
  console.warn(`CORS: Blocked origin: ${origin}`);
  return callback(new Error('Not allowed by CORS'), false);
};

// Основная конфигурация CORS
export const corsConfig = cors({
  origin: originCheck,
  credentials: true, // Разрешаем cookies и авторизационные заголовки
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma',
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Per-Page',
  ],
  maxAge: 86400, // 24 часа для preflight cache
  optionsSuccessStatus: 200, // Для поддержки старых браузеров
});

// Строгая конфигурация CORS для аутентификации
export const authCorsConfig = cors({
  origin: (origin, callback) => {
    // Для аутентификации требуем origin
    if (!origin) {
      return callback(new Error('Origin required for authentication'), false);
    }
    return originCheck(origin, callback);
  },
  credentials: true,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 300, // 5 минут для preflight cache
  optionsSuccessStatus: 200,
});

// Публичная конфигурация CORS (более мягкая)
export const publicCorsConfig = cors({
  origin: originCheck,
  credentials: false, // Публичные API не требуют credentials
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
  ],
  exposedHeaders: ['Content-Type'],
  maxAge: 3600, // 1 час для preflight cache
  optionsSuccessStatus: 200,
  preflightContinue: false,
});

// Middleware для обработки preflight запросов
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handlePreflight = (req: Request, res: Response, next: any) => {
  if (req.method === 'OPTIONS') {
    // Preflight запросы обрабатываются CORS middleware, но если нужно, можем добавить заголовки здесь
    res.status(200).end();
    return;
  }
  next();
};

// Middleware для логирования CORS запросов (только в development)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const corsLogger = (req: Request, res: Response, next: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `CORS: ${req.method} ${req.path} from ${req.headers.origin || 'no-origin'}`
    );
  }
  next();
};
