"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const posts_controller_1 = require("../controllers/posts.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limit_middleware_1 = require("../middleware/rate-limit.middleware");
const moderation_middleware_1 = require("../middleware/moderation.middleware");
const router = (0, express_1.Router)();
router.post('/', auth_middleware_1.authenticate, rate_limit_middleware_1.postRateLimit, moderation_middleware_1.moderatePost, [
    (0, express_validator_1.body)('type').isIn(['image', 'video', 'carousel', 'text']),
    (0, express_validator_1.body)('caption').optional().trim().isLength({ max: 2000 }),
], posts_controller_1.createPost);
router.get('/feed', auth_middleware_1.authenticate, posts_controller_1.getFeed);
router.get('/faculty/:facultyId', auth_middleware_1.authenticate, posts_controller_1.getFacultyPosts);
router.get('/:postId', auth_middleware_1.authenticate, posts_controller_1.getPost);
router.post('/:postId/like', auth_middleware_1.authenticate, rate_limit_middleware_1.interactionRateLimit, posts_controller_1.likePost);
router.post('/:postId/comments', auth_middleware_1.authenticate, rate_limit_middleware_1.commentRateLimit, moderation_middleware_1.moderateComment, [
    (0, express_validator_1.body)('text').trim().notEmpty().isLength({ max: 500 }),
], posts_controller_1.commentOnPost);
router.get('/:postId/comments', auth_middleware_1.authenticate, posts_controller_1.getPostComments);
exports.default = router;
