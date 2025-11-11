import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { subscriptionsController } from '../controllers/subscriptions.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get subscription plans
router.get('/plans', subscriptionsController.getPlans);

// Get user subscription status
router.get('/status', subscriptionsController.getSubscriptionStatus);

export default router;

