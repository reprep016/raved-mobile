import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import { supportController } from '../controllers/support.controller';

const router = Router();

// Contact support
router.post('/contact', authenticate, [
  body('subject').trim().notEmpty().isLength({ min: 3, max: 200 }),
  body('message').trim().notEmpty().isLength({ min: 10, max: 2000 }),
], supportController.contactSupport);

export default router;

