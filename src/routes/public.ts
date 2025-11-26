import { Router } from 'express';
import {
  getPublicProfileBySlug,
  bookPublicSlot,
  getTimeslots,
  getReviewsBySlug,
  createReview,
} from '../controllers/publicController';
import { validate } from '../middleware/validate';
import {
  BookingRequestSchema,
  SlugParamSchema,
  TimeslotsQuerySchema,
  CreateReviewRequestSchema,
} from '../schemas/public';

const router = Router();

router.get(
  '/:slug',
  validate({ params: SlugParamSchema }),
  getPublicProfileBySlug
);
router.get(
  '/:slug/timeslots',
  validate({ params: SlugParamSchema, query: TimeslotsQuerySchema }),
  getTimeslots
);
router.post(
  '/:slug/book',
  validate({ params: SlugParamSchema, body: BookingRequestSchema }),
  bookPublicSlot
);
router.get(
  '/:slug/reviews',
  validate({ params: SlugParamSchema }),
  getReviewsBySlug
);
router.post(
  '/:slug/reviews',
  validate({ params: SlugParamSchema, body: CreateReviewRequestSchema }),
  createReview
);

export default router;
