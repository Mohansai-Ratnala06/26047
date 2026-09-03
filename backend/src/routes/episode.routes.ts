import { Router } from 'express';
import { createEpisode, getEpisodes, getEpisodeById, updateEpisode } from '../controllers/episode.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/', protect, createEpisode as any);
router.get('/', protect, getEpisodes as any);
router.get('/:episodeId', protect, getEpisodeById as any);
router.patch('/:episodeId', protect, updateEpisode as any);

export default router;
