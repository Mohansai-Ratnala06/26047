import { Router } from 'express';
import { sendMessage, getMessages, getMessagesByEpisode } from '../controllers/message.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.get('/episode/:episodeId', protect, getMessagesByEpisode as any);
router.post('/:conversationId', protect, sendMessage as any);
router.get('/:conversationId', protect, getMessages as any);

export default router;
