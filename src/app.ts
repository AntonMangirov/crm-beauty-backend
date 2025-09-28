import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './prismaClient';
import authRouter from './routes/auth';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRouter);

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

// Get all users
app.get('/api/users', async (req, res) => {
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

// Get all services
app.get('/api/services', async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      include: {
        master: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    res.json(services);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch services',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get appointments
app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      include: {
        master: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        service: {
          select: {
            id: true,
            name: true,
            price: true,
            durationMin: true,
          },
        },
      },
      orderBy: {
        startAt: 'desc',
      },
    });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch appointments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default app;
