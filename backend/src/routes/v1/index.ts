import { Router } from 'express';
import healthRoutes from '../health.routes';
import authRoutes from '../auth.routes';
import patientRoutes from '../patient.routes';
import healthProfileRoutes from '../healthProfile.routes';
import consentRoutes from '../consent.routes';
import episodeRoutes from '../episode.routes';
import conversationRoutes from '../conversation.routes';
import messageRoutes from '../message.routes';
import documentRoutes from '../document.routes';
import assessmentRoutes from '../assessment.routes';
import doctorRoutes from '../doctor.routes';

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/health-profile', healthProfileRoutes);
router.use('/consents', consentRoutes);
router.use('/episodes', episodeRoutes);
router.use('/conversations', conversationRoutes);
router.use('/messages', messageRoutes);
router.use('/documents', documentRoutes);
router.use('/assessments', assessmentRoutes);
router.use('/doctor', doctorRoutes);

export default router;
