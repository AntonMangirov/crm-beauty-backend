import { Router } from 'express';
import { auth } from '../middleware/auth';
import {
  getMe,
  updateProfile,
  getAppointments,
} from '../controllers/meController';
import {
  getServices,
  createService,
  updateService,
  deleteService,
  getServiceById,
} from '../controllers/servicesController';

const router = Router();

// Все роуты требуют авторизации
router.use(auth);

// GET /api/me - получить полную информацию о мастере
router.get('/', getMe);

// PUT /api/me/profile - обновить профиль мастера
router.put('/profile', updateProfile);

// GET /api/me/appointments - получить записи мастера с фильтрами
router.get('/appointments', getAppointments);

// GET /api/me/services - получить все услуги мастера
router.get('/services', getServices);

// POST /api/me/services - создать новую услугу
router.post('/services', createService);

// GET /api/me/services/:id - получить услугу по ID
router.get('/services/:id', getServiceById);

// PUT /api/me/services/:id - обновить услугу
router.put('/services/:id', updateService);

// DELETE /api/me/services/:id - удалить услугу
router.delete('/services/:id', deleteService);

export default router;
