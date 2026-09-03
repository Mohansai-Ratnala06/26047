import { Router } from 'express';
import {
  createConversation,
  getConversationsByEpisode,
  getConversationById,
} from '../controllers/conversation.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/', protect, createConversation as any);
router.get('/episode/:episodeId', protect, getConversationsByEpisode as any);
router.get('/:conversationId', protect, getConversationById as any);

export default router;
