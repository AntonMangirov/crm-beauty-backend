import { Router } from 'express';
import { auth } from '../middleware/auth';
import {
  getMe,
  updateProfile,
  getAppointments,
  uploadPhoto,
  updateAppointmentStatus,
  getClients,
} from '../controllers/meController';
import {
  getServices,
  createService,
  updateService,
  deleteService,
  getServiceById,
} from '../controllers/servicesController';
import { upload } from '../middleware/upload';

const router = Router();

// Все роуты требуют авторизации
router.use(auth);

// GET /api/me - получить полную информацию о мастере
router.get('/', getMe);

// PATCH /api/me/profile - обновить профиль мастера (name, description, address, photoUrl)
router.patch('/profile', updateProfile);

// POST /api/me/profile/upload-photo - загрузить фото профиля
router.post('/profile/upload-photo', upload.single('photo'), uploadPhoto);

// GET /api/me/appointments - получить записи мастера с фильтрами
router.get('/appointments', getAppointments);

// PUT /api/me/appointments/:id - обновить статус записи
router.put('/appointments/:id', updateAppointmentStatus);

// GET /api/me/clients - получить список клиентов мастера
router.get('/clients', getClients);

// GET /api/me/services - получить все услуги мастера
router.get('/services', getServices);

// POST /api/me/services - создать новую услугу
router.post('/services', createService);

// GET /api/me/services/:id - получить услугу по ID
router.get('/services/:id', getServiceById);

// PATCH /api/me/services/:id - обновить услугу
router.patch('/services/:id', updateService);

// DELETE /api/me/services/:id - удалить услугу
router.delete('/services/:id', deleteService);

export default router;
