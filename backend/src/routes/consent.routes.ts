import { Router } from 'express';
import { createConsent, getConsents, updateConsent } from '../controllers/consent.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/', protect, createConsent as any);
router.get('/', protect, getConsents as any);
router.patch('/:consentId', protect, updateConsent as any);

export default router;
