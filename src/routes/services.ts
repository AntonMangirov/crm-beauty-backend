import { Router } from 'express';
import { auth } from '../middleware/auth';
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

// GET /api/services - получить все услуги мастера
router.get('/', getServices);

// POST /api/services - создать новую услугу
router.post('/', createService);

// GET /api/services/:id - получить услугу по ID
router.get('/:id', getServiceById);

// PATCH /api/services/:id - обновить услугу
router.patch('/:id', updateService);

// DELETE /api/services/:id - удалить услугу
router.delete('/:id', deleteService);

export default router;
