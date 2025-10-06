import { Router } from 'express';
import { getPublicProfileBySlug } from '../controllers/publicController';

const router = Router();

router.get('/:slug', getPublicProfileBySlug);

export default router;
