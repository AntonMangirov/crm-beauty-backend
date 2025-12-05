import { Router } from 'express';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  UpdateScheduleSchema,
  UpdateClientSchema,
  RescheduleAppointmentSchema,
} from '../schemas/me';
import {
  getMe,
  updateProfile,
  uploadPhoto,
} from '../controllers/ProfileController';
import {
  getAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
  getLastManualAppointments,
} from '../controllers/AppointmentController';
import {
  getClients,
  getClientHistory,
  updateClient,
} from '../controllers/ClientController';
import {
  uploadAppointmentPhotos,
  deleteAppointmentPhoto,
} from '../controllers/PhotoController';
import { getAnalytics } from '../controllers/AnalyticsController';
import {
  getPortfolio,
  uploadPortfolioPhoto,
  deletePortfolioPhoto,
} from '../controllers/PortfolioController';
import {
  changePassword,
  changeEmail,
  changePhone,
} from '../controllers/AccountController';
import { getSchedule, updateSchedule } from '../controllers/ScheduleController';
import { getTopServices } from '../controllers/TopServicesController';
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

// GET /api/me/appointments/last-manual - получить последние ручные записи
router.get('/appointments/last-manual', getLastManualAppointments);

// PUT /api/me/appointments/:id - обновить статус записи
router.put('/appointments/:id', updateAppointmentStatus);

// PATCH /api/me/appointments/:id/reschedule - перенести встречу (изменить время)
router.patch(
  '/appointments/:id/reschedule',
  validate({ body: RescheduleAppointmentSchema }),
  rescheduleAppointment
);

// POST /api/me/appointments/:id/photos - загрузить фото к записи
router.post(
  '/appointments/:id/photos',
  upload.array('photos', 10), // Максимум 10 фото за раз
  uploadAppointmentPhotos
);

// DELETE /api/me/appointments/:id/photos/:photoId - удалить фото из записи
router.delete('/appointments/:id/photos/:photoId', deleteAppointmentPhoto);

// GET /api/me/clients - получить список клиентов мастера
router.get('/clients', getClients);

// GET /api/me/clients/:id/history - получить историю посещений клиента
router.get('/clients/:id/history', getClientHistory);

// PATCH /api/me/clients/:id - обновить данные клиента
router.patch(
  '/clients/:id',
  validate({ body: UpdateClientSchema }),
  updateClient
);

// GET /api/me/services - получить все услуги мастера
router.get('/services', getServices);

// GET /api/me/services/top - получить топ-5 наиболее используемых услуг
router.get('/services/top', getTopServices);

// POST /api/me/services - создать новую услугу
router.post('/services', createService);

// GET /api/me/services/:id - получить услугу по ID
router.get('/services/:id', getServiceById);

// PATCH /api/me/services/:id - обновить услугу
router.patch('/services/:id', updateService);

// DELETE /api/me/services/:id - удалить услугу
router.delete('/services/:id', deleteService);

// GET /api/me/analytics - получить аналитику за текущий месяц
router.get('/analytics', getAnalytics);

// GET /api/me/portfolio - получить портфолио мастера
router.get('/portfolio', getPortfolio);

// POST /api/me/portfolio/photos - загрузить фото в портфолио
router.post('/portfolio/photos', upload.single('photo'), uploadPortfolioPhoto);

// DELETE /api/me/portfolio/photos/:id - удалить фото из портфолио
router.delete('/portfolio/photos/:id', deletePortfolioPhoto);

// PATCH /api/me/settings/password - изменить пароль
router.patch('/settings/password', changePassword);

// PATCH /api/me/settings/email - изменить email
router.patch('/settings/email', changeEmail);

// PATCH /api/me/settings/phone - изменить телефон
router.patch('/settings/phone', changePhone);

// GET /api/me/schedule - получить расписание работы мастера
router.get('/schedule', getSchedule);

// PUT /api/me/schedule - обновить расписание работы мастера
router.put(
  '/schedule',
  validate({ body: UpdateScheduleSchema }),
  updateSchedule
);

export default router;
