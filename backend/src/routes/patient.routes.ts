import { Router } from 'express';
import { createPatient, getMe, updateMe } from '../controllers/patient.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/', protect, createPatient as any);
router.get('/me', protect, getMe as any);
router.patch('/me', protect, updateMe as any);

export default router;
