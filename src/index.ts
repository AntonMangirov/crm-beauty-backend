import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Базовый маршрут
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'CRM Beauty Backend is running',
    timestamp: new Date().toISOString(),
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

export default app;
