import { Router } from 'express';
import { body } from 'express-validator';
import {
  getStoreItems,
  getStoreItem,
  createStoreItem,
} from '../controllers/store.controller';
import { authenticate, requirePremium } from '../middleware/auth.middleware';

const router = Router();

router.get('/items', authenticate, getStoreItems);

router.get('/items/:itemId', authenticate, getStoreItem);

// Creating store items requires premium
router.post('/items', authenticate, requirePremium, [
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('price').isFloat({ min: 0.01 }),
    body('category').isIn(['clothing', 'shoes', 'accessories', 'bags', 'jewelry']),
    body('condition').isIn(['new', 'like-new', 'good', 'fair']),
], createStoreItem);

export default router;
