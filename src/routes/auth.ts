import { Router } from 'express';
import {
  register,
  login,
  me,
  requestPasswordReset,
  verifyPasswordResetCode,
  resetPassword,
} from '../controllers/authController';
import { refreshToken, logout } from '../controllers/refreshController';
import { auth } from '../middleware/auth';

const router = Router();

// Базовые маршруты аутентификации (без rate limiting для разработки)
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', auth, me);

// Маршруты восстановления пароля
router.post('/password-reset/request', requestPasswordReset);
router.post('/password-reset/verify', verifyPasswordResetCode);
router.post('/password-reset/reset', resetPassword);

export default router;
