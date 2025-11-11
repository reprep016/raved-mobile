"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentOnPost = void 0;
const mongoose_1 = require("../models/mongoose");
const database_1 = require("../config/database");
const notifications_controller_1 = require("../controllers/notifications.controller");
const utils_1 = require("../utils");
const commentOnPost = async (postId, userId, text, parentCommentId, userSubscription) => {
    const post = await mongoose_1.Post.findOne({ _id: postId, deletedAt: null });
    if (!post) {
        throw new Error('Post not found');
    }
    const comment = await mongoose_1.Comment.create({
        postId,
        userId,
        text,
        parentCommentId: parentCommentId || null
    });
    try {
        await mongoose_1.Post.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } });
        if (post.userId !== userId) {
            // Get user details for notification
            const userResult = await database_1.pgPool.query('SELECT first_name, last_name FROM users WHERE id = $1', [userId]);
            const user = userResult.rows[0];
            const actorName = `${user.first_name} ${user.last_name}`;
            // Create notification using the controller
            await notifications_controller_1.notificationsController.createNotification(post.userId, 'comment', 'New Comment', `${actorName} commented on your post`, userId, { postId, commentId: comment._id, type: 'post' });
            if (userSubscription === 'premium') {
                // await updateUserScore(post.userId, 'comment');
            }
        }
        const user = await database_1.pgPool.query('SELECT id, username, first_name, last_name, avatar_url FROM users WHERE id = $1', [userId]);
        return {
            id: comment._id,
            text: comment.text,
            user: {
                id: user.rows[0].id,
                username: user.rows[0].username,
                name: `${user.rows[0].first_name} ${user.rows[0].last_name}`,
                avatarUrl: (0, utils_1.getAvatarUrl)(user.rows[0].avatar_url, user.rows[0].id)
            },
            createdAt: comment.createdAt,
        };
    }
    catch (error) {
        // Rollback
        await mongoose_1.Comment.deleteOne({ _id: comment._id });
        throw error;
    }
};
exports.commentOnPost = commentOnPost;
