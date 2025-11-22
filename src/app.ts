import express from 'express';
import dotenv from 'dotenv';
import prisma from './prismaClient';
import { Prisma } from '@prisma/client';
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

// 1. CORS logger (для отладки)
app.use(corsLogger);

// 2. Body parsing middleware (до rate limiting, чтобы body был доступен)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статические файлы для локальных загрузок
// Используется если UPLOAD_MODE=local или не указаны переменные Cloudinary
const uploadMode = process.env.UPLOAD_MODE || 'local';
const hasCloudinary = !!process.env.CLOUDINARY_CLOUD_NAME;

if (uploadMode === 'local' || !hasCloudinary) {
  app.use('/uploads', express.static('uploads'));
  console.log('[UPLOAD] Using local file storage: /uploads');
}

// 3. Базовые middleware безопасности (БЕЗ Helmet пока, чтобы не блокировать CORS)
app.use(securityHeaders);
app.use(requestSizeLimit(10 * 1024 * 1024)); // 10MB лимит
app.use(sanitizeInput);

// 4. Time middleware
app.use(timeLoggingMiddleware);
app.use(addTimeStampsMiddleware);
app.use(timezoneMiddleware);

// 5. Общий rate limiting
app.use(generalRateLimit);

// 6. Root endpoint (информация об API)
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

// 7. Специфичные CORS и rate limiting для разных endpoints
app.use('/api/auth', authCorsConfig, authRateLimit, authRouter);
app.use('/api/public', publicCorsConfig, publicRateLimit, publicRouter);
app.use('/api/services', corsConfig, servicesRouter);
app.use('/api/me', corsConfig, meRouter);

// 8. Helmet применяется ПОСЛЕ CORS, чтобы не блокировать заголовки
app.use(helmetConfig);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'CRM Beauty Backend is running',
    timestamp: new Date().toISOString(),
  });
});

// Database connection test
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

// Get all users (защищённый эндпоинт для админов)
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

// Приватный список встреч мастера (по userId из токена)
// GET /api/appointments?dateFrom&dateTo
app.get('/api/appointments', corsConfig, auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { dateFrom, dateTo } = req.query as {
      dateFrom?: string;
      dateTo?: string;
    };

    let startFilter: Date | undefined;
    let endFilter: Date | undefined;

    if (dateFrom) {
      const d = new Date(dateFrom);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: 'Invalid dateFrom' });
      }
      startFilter = d;
    }

    if (dateTo) {
      const d = new Date(dateTo);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: 'Invalid dateTo' });
      }
      endFilter = d;
    }

    const where: Prisma.AppointmentWhereInput = { masterId: userId };
    if (startFilter || endFilter) {
      where.startAt = {};
      if (startFilter) where.startAt.gte = startFilter;
      if (endFilter) where.startAt.lte = endFilter;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        master: {
          select: { id: true, name: true, email: true },
        },
        client: {
          select: { id: true, name: true, phone: true },
        },
        service: {
          select: { id: true, name: true, price: true, durationMin: true },
        },
      },
      orderBy: { startAt: 'desc' },
    });

    res.json(appointments);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch appointments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Error handling middleware (должен быть последним)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
