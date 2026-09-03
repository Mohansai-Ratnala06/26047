import { Router } from 'express';
import { doctorController } from '../controllers/doctor.controller';

const router = Router();

// POST /api/v1/doctor/login — public, no JWT guard needed
router.post('/login', doctorController.login);

export default router;
