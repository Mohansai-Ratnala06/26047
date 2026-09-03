import { Router } from 'express';
import { getHealthProfile, updateHealthProfile } from '../controllers/healthProfile.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.get('/', protect, getHealthProfile as any);
router.put('/', protect, updateHealthProfile as any);

export default router;
