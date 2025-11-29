import cors from 'cors';
import { Request, Response } from 'express';

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8080',
];

const devOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:8080',
];

/* eslint-disable no-unused-vars */
const originCheck = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  /* eslint-enable no-unused-vars */
  if (!origin) {
    return callback(null, true);
  }

  const isDevelopment = process.env.NODE_ENV !== 'production';
  const allowedList = isDevelopment
    ? [...allowedOrigins, ...devOrigins]
    : allowedOrigins;

  if (allowedList.includes(origin)) {
    return callback(null, true);
  }

  console.warn(`CORS: Blocked origin: ${origin}`);
  return callback(new Error('Not allowed by CORS'), false);
};

export const corsConfig = cors({
  origin: originCheck,
  credentials: true,
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
  maxAge: 86400,
  optionsSuccessStatus: 200,
});

export const authCorsConfig = cors({
  origin: (origin, callback) => {
    // В тестовом и dev окружении разрешаем запросы без origin
    const isDevOrTest =
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    if (isDevOrTest && !origin) {
      return callback(null, true);
    }
    if (!origin) {
      return callback(new Error('Origin required for authentication'), false);
    }
    return originCheck(origin, callback);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
  ],
  maxAge: 300,
  optionsSuccessStatus: 200,
});

export const publicCorsConfig = cors({
  origin: originCheck,
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
  ],
  exposedHeaders: ['Content-Type'],
  maxAge: 3600,
  optionsSuccessStatus: 200,
  preflightContinue: false,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handlePreflight = (req: Request, res: Response, next: any) => {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const corsLogger = (req: Request, res: Response, next: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `CORS: ${req.method} ${req.path} from ${req.headers.origin || 'no-origin'}`
    );
  }
  next();
};
