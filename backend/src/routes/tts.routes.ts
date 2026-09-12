import { Router } from 'express';
import { synthesizeSpeech, getTtsHealth } from '../controllers/tts.controller';

const router = Router();

/**
 * @route   POST /api/v1/tts/synthesize
 * @desc    Synthesizes multilingual audio from text via Sarvam AI Bulbul v3
 */
router.post('/synthesize', synthesizeSpeech);

/**
 * @route   GET /api/v1/tts/health
 * @desc    Checks health of upstream TTS service
 */
router.get('/health', getTtsHealth);

export default router;
