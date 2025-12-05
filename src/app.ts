import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import prisma from './prismaClient';
import authRouter from './routes/auth';
import publicRouter from './routes/public';
import servicesRouter from './routes/services';
import meRouter from './routes/me';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import {
  helmetConfig,
  generalRateLimit,
  authRateLimit,
  publicRateLimit,
  requestSizeLimit,
  sanitizeInput,
  securityHeaders,
} from './middleware/security';
import {
  corsConfig,
  authCorsConfig,
  publicCorsConfig,
  corsLogger,
} from './middleware/cors';
import {
  timeLoggingMiddleware,
  addTimeStampsMiddleware,
  timezoneMiddleware,
} from './middleware/timeMiddleware';
import { auth } from './middleware/auth';

dotenv.config();

const app = express();

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const uploadMode = process.env.UPLOAD_MODE || 'local';
const hasCloudinary = !!process.env.CLOUDINARY_CLOUD_NAME;

if (uploadMode === 'local' || !hasCloudinary) {
  app.use('/uploads', express.static('uploads'));
}

// CORS должен быть применен ПЕРВЫМ, до всех других middleware
// Применяем глобальный CORS для всех запросов (включая ошибки)
app.use(corsConfig);
app.use(corsLogger);

app.use(securityHeaders);
app.use(requestSizeLimit(10 * 1024 * 1024));
app.use(sanitizeInput);
app.use(timeLoggingMiddleware);
app.use(addTimeStampsMiddleware);
app.use(timezoneMiddleware);
// Отключаем rate limiting в тестовом окружении
if (process.env.NODE_ENV !== 'test') {
  app.use(generalRateLimit);
}
app.get('/', (req, res) => {
  res.json({
    name: 'CRM Beauty Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      public: '/api/public',
      auth: '/api/auth',
      services: '/api/services',
      me: '/api/me',
    },
    timestamp: new Date().toISOString(),
  });
});

// Применяем rate limiting только если не тестовое окружение
if (process.env.NODE_ENV === 'test') {
  app.use('/api/auth', authCorsConfig, authRouter);
  app.use('/api/public', publicCorsConfig, publicRouter);
} else {
  app.use('/api/auth', authCorsConfig, authRateLimit, authRouter);
  app.use('/api/public', publicCorsConfig, publicRateLimit, publicRouter);
}
app.use('/api/services', corsConfig, servicesRouter);
app.use('/api/me', corsConfig, meRouter);
// Helmet применяется после CORS, чтобы не блокировать CORS заголовки
app.use(helmetConfig);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'CRM Beauty Backend is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/db/status', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'OK',
      message: 'Database connection successful',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/api/users', corsConfig, auth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch users',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.use(notFoundHandler);

// Error handler должен быть последним и иметь правильную сигнатуру для Express 5
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    // Проверяем, не был ли ответ уже отправлен
    if (res.headersSent) {
      return next(err);
    }
    errorHandler(err, req, res, next);
  }
);

export default app;
