import { Router } from 'express';
import { register, login, me } from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register as any);
router.post('/login', login as any);
router.get('/me', protect, me as any);

export default router;
