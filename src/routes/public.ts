import { Router } from 'express';
import {
  getPublicProfileBySlug,
  bookPublicSlot,
} from '../controllers/publicController';

const router = Router();

router.get('/:slug', getPublicProfileBySlug);
router.post('/:slug/book', bookPublicSlot);

export default router;
