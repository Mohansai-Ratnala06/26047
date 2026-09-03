import { Router } from 'express';
import { explainBrainDiagnosisHandler } from '../controllers/patientExplainer.controller';

const router = Router();

// Endpoint for patient-side client or clinical workflow
router.post('/explain', explainBrainDiagnosisHandler);

export default router;
