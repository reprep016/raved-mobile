import { Router } from 'express';
import { body } from 'express-validator';
import {
  createPost,
  getFeed,
  getPost,
  likePost,
  commentOnPost,
  getPostComments,
  getFacultyPosts,
  getPostSuggestions,
  getTrendingPosts,
} from '../controllers/posts.controller';
import { authenticate } from '../middleware/auth.middleware';
import { postRateLimit, commentRateLimit, interactionRateLimit } from '../middleware/rate-limit.middleware';
import { moderatePost, moderateComment } from '../middleware/moderation.middleware';

const router = Router();

router.post('/', authenticate, postRateLimit, moderatePost, [
    body('type').isIn(['image', 'video', 'carousel', 'text']),
    body('caption').optional().trim().isLength({ max: 2000 }),
], createPost);

router.get('/feed', authenticate, getFeed);

router.get('/suggestions', authenticate, getPostSuggestions);

router.get('/trending', authenticate, getTrendingPosts);

router.get('/faculty/:facultyId', authenticate, getFacultyPosts);

router.get('/:postId', authenticate, getPost);

router.post('/:postId/like', authenticate, interactionRateLimit, likePost);

router.post('/:postId/comments', authenticate, commentRateLimit, moderateComment, [
    body('text').trim().notEmpty().isLength({ max: 500 }),
], commentOnPost);

router.get('/:postId/comments', authenticate, getPostComments);

export default router;
