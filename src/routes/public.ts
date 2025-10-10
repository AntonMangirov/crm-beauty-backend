import { Router } from 'express';
import {
  getPublicProfileBySlug,
  bookPublicSlot,
} from '../controllers/publicController';
import { validate } from '../middleware/validate';
import { BookingRequestSchema, SlugParamSchema } from '../schemas/public';

const router = Router();

router.get(
  '/:slug',
  validate({ params: SlugParamSchema }),
  getPublicProfileBySlug
);
router.post(
  '/:slug/book',
  validate({ params: SlugParamSchema, body: BookingRequestSchema }),
  bookPublicSlot
);

export default router;
