import { Router } from 'express';
import {
  createDocument,
  getDocumentsByPatient,
  getDocumentsByEpisode,
  updateExtractionStatus,
} from '../controllers/document.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/', protect, createDocument as any);
router.get('/', protect, getDocumentsByPatient as any);
router.get('/episode/:episodeId', protect, getDocumentsByEpisode as any);
router.patch('/:documentId/status', protect, updateExtractionStatus as any);

export default router;
