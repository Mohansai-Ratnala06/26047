import { Router } from 'express';
import {
  createAssessment,
  getAssessmentsByEpisode,
  updateAssessment,
} from '../controllers/assessment.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/', protect, createAssessment as any);
router.get('/episode/:episodeId', protect, getAssessmentsByEpisode as any);
router.patch('/:assessmentId', protect, updateAssessment as any);

export default router;
