import { Router } from 'express';
import { recommendFacilities } from '../controllers/facility.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.use(protect);
router.post('/recommend', recommendFacilities as any);

export default router;
