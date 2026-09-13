import { Router } from 'express';
import {
  createDocument,
  uploadDocument,
  multerUpload,
  getDocumentsByPatient,
  getDocumentsByEpisode,
  getDocumentById,
  getDocumentFile,
  deleteDocument,
  updateExtractionStatus,
} from '../controllers/document.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/upload', protect, multerUpload.single('file'), uploadDocument as any);
router.post('/', protect, createDocument as any);
router.get('/', protect, getDocumentsByPatient as any);
router.get('/episode/:episodeId', protect, getDocumentsByEpisode as any);
router.get('/:documentId', protect, getDocumentById as any);
router.get('/:documentId/file', protect, getDocumentFile as any);
router.delete('/:documentId', protect, deleteDocument as any);
router.patch('/:documentId/status', protect, updateExtractionStatus as any);

export default router;
