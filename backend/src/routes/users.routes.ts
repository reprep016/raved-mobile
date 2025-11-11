import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { usersController } from '../controllers/users.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get current user profile
router.get('/profile', usersController.getProfile);

// Update current user profile
router.put('/profile', usersController.updateProfile);

// Update avatar
router.put('/avatar', usersController.updateAvatar);

// Get user stats
router.get('/stats', usersController.getUserStats);

// Get user by ID profile
router.get('/:userId', usersController.getProfile);

// Get user stats by ID
router.get('/:userId/stats', usersController.getUserStats);

// Get user posts
router.get('/:userId/posts', usersController.getUserPosts);

// Get user comments
router.get('/:userId/comments', usersController.getUserComments);

// Get user liked posts
router.get('/:userId/liked-posts', usersController.getUserLikedPosts);

// Get user saved posts
router.get('/:userId/saved-posts', usersController.getUserSavedPosts);

export default router;

