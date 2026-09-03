import { Router } from 'express';
import multer from 'multer';
import { transcribeAudio, getSttHealth } from '../controllers/stt.controller';

const router = Router();

// Store uploaded audio in memory (max 20MB, matching STT API limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

/**
 * @route   POST /api/v1/stt/transcribe
 * @desc    Accepts multipart/form-data audio file, forwards to STT API, returns transcript
 */
router.post('/transcribe', upload.single('audio'), transcribeAudio);

/**
 * @route   GET /api/v1/stt/health
 * @desc    Checks health of upstream STT API
 */
router.get('/health', getSttHealth);

export default router;
