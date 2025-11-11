import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { rankingsController } from '../controllers/rankings.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get rankings
router.get('/', rankingsController.getRankings);

export default router;

