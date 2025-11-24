import { Router } from 'express';
import { register, login, me } from '../controllers/authController';
import { refreshToken, logout } from '../controllers/refreshController';
import { auth } from '../middleware/auth';

const router = Router();

// Базовые маршруты аутентификации (без rate limiting для разработки)
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', auth, me);

export default router;
