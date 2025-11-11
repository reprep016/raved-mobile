"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectionService = void 0;
const database_1 = require("../config/database");
const notifications_controller_1 = require("../controllers/notifications.controller");
const utils_1 = require("../utils");
exports.connectionService = {
    sendFollowRequest: async (followerId, followingId) => {
        if (followerId === followingId) {
            throw new Error('Cannot follow yourself');
        }
        const targetUserResult = await database_1.pgPool.query('SELECT is_private FROM users WHERE id = $1 AND deleted_at IS NULL', [followingId]);
        if (targetUserResult.rows.length === 0) {
            throw new Error('User not found');
        }
        const isPrivate = targetUserResult.rows[0].is_private;
        const existingConnectionResult = await database_1.pgPool.query('SELECT * FROM connections WHERE follower_id = $1 AND following_id = $2', [followerId, followingId]);
        if (existingConnectionResult.rows.length > 0) {
            throw new Error('Connection already exists or requested');
        }
        if (isPrivate) {
            await database_1.pgPool.query('INSERT INTO connections (follower_id, following_id, status) VALUES ($1, $2, $3)', [followerId, followingId, 'pending']);
            // Get user details for notification
            const userResult = await database_1.pgPool.query('SELECT first_name, last_name FROM users WHERE id = $1', [followerId]);
            const user = userResult.rows[0];
            const actorName = `${user.first_name} ${user.last_name}`;
            // Create notification using the controller
            await notifications_controller_1.notificationsController.createNotification(followingId, 'follow_request', 'Follow Request', `${actorName} sent you a follow request`, followerId, { type: 'follow_request' });
            return 'pending';
        }
        else {
            await database_1.pgPool.query('INSERT INTO connections (follower_id, following_id, status) VALUES ($1, $2, $3)', [followerId, followingId, 'following']);
            await database_1.pgPool.query('UPDATE users SET following_count = following_count + 1 WHERE id = $1', [followerId]);
            await database_1.pgPool.query('UPDATE users SET followers_count = followers_count + 1 WHERE id = $1', [followingId]);
            // Get user details for notification
            const userResult = await database_1.pgPool.query('SELECT first_name, last_name FROM users WHERE id = $1', [followerId]);
            const user = userResult.rows[0];
            const actorName = `${user.first_name} ${user.last_name}`;
            // Create notification using the controller
            await notifications_controller_1.notificationsController.createNotification(followingId, 'follow', 'New Follower', `${actorName} started following you`, followerId, { type: 'follow' });
            return 'following';
        }
    },
    getPendingFollowRequests: async (userId) => {
        const result = await database_1.pgPool.query(`
      SELECT c.id as request_id, c.created_at, 
             u.id, u.username, u.first_name, u.last_name, u.avatar_url, u.faculty
      FROM connections c
      JOIN users u ON c.follower_id = u.id
      WHERE c.following_id = $1 AND c.status = 'pending'
      ORDER BY c.created_at DESC
    `, [userId]);
        return result.rows.map(row => ({
            requestId: row.request_id,
            user: {
                id: row.id,
                username: row.username,
                name: `${row.first_name} ${row.last_name}`,
                avatarUrl: (0, utils_1.getAvatarUrl)(row.avatar_url, row.id),
                faculty: row.faculty
            },
            requestedAt: row.created_at,
            // timeAgo: getTimeAgo(row.created_at) // Assuming getTimeAgo is available globally or imported
        }));
    },
    approveFollowRequest: async (requestId, userId) => {
        const result = await database_1.pgPool.query(`
      UPDATE connections 
      SET status = 'following'
      WHERE id = $1 AND following_id = $2 AND status = 'pending'
      RETURNING follower_id
    `, [requestId, userId]);
        if (result.rows.length === 0) {
            throw new Error('Request not found');
        }
        const followerId = result.rows[0].follower_id;
        await database_1.pgPool.query('UPDATE users SET followers_count = followers_count + 1 WHERE id = $1', [userId]);
        await database_1.pgPool.query('UPDATE users SET following_count = following_count + 1 WHERE id = $1', [followerId]);
        // Get user details for notification
        const userResult = await database_1.pgPool.query('SELECT first_name, last_name FROM users WHERE id = $1', [userId]);
        const user = userResult.rows[0];
        const actorName = `${user.first_name} ${user.last_name}`;
        // Create notification using the controller
        await notifications_controller_1.notificationsController.createNotification(followerId, 'follow_request_approved', 'Follow Request Approved', `${actorName} approved your follow request`, userId, { type: 'follow_request_approved' });
    },
    rejectFollowRequest: async (requestId, userId) => {
        const result = await database_1.pgPool.query(`
      DELETE FROM connections 
      WHERE id = $1 AND following_id = $2 AND status = 'pending'
      RETURNING follower_id
    `, [requestId, userId]);
        if (result.rows.length === 0) {
            throw new Error('Request not found');
        }
    },
    blockUser: async (blockerId, blockedId) => {
        if (blockerId === blockedId) {
            throw new Error('Cannot block yourself');
        }
        await database_1.pgPool.query(`
      DELETE FROM connections 
      WHERE (follower_id = $1 AND following_id = $2) 
         OR (follower_id = $2 AND following_id = $1)
    `, [blockerId, blockedId]);
        await database_1.pgPool.query(`
      INSERT INTO blocked_users (blocker_id, blocked_id)
      VALUES ($1, $2)
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    `, [blockerId, blockedId]);
        // Update counts more accurately, considering if they were following each other
        const connectionCheck = await database_1.pgPool.query(`
      SELECT * FROM connections
      WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)
    `, [blockerId, blockedId]);
        // If they were following each other, decrement both counts
        if (connectionCheck.rows.length > 0) {
            await database_1.pgPool.query(`
        UPDATE users
        SET followers_count = GREATEST(0, followers_count - 1)
        WHERE id = $1
      `, [blockedId]);
            await database_1.pgPool.query(`
        UPDATE users
        SET following_count = GREATEST(0, following_count - 1)
        WHERE id = $1
      `, [blockerId]);
        }
    },
    unblockUser: async (blockerId, blockedId) => {
        const result = await database_1.pgPool.query(`
      DELETE FROM blocked_users 
      WHERE blocker_id = $1 AND blocked_id = $2
      RETURNING *
    `, [blockerId, blockedId]);
        if (result.rows.length === 0) {
            throw new Error('Block record not found');
        }
    },
    getBlockedUsers: async (userId) => {
        const result = await database_1.pgPool.query(`
      SELECT u.id, u.username, u.first_name, u.last_name, u.avatar_url,
             b.created_at as blocked_at
      FROM blocked_users b
      JOIN users u ON b.blocked_id = u.id
      WHERE b.blocker_id = $1
      ORDER BY b.created_at DESC
    `, [userId]);
        return result.rows.map(row => ({
            id: row.id,
            username: row.username,
            name: `${row.first_name} ${row.last_name}`,
            avatarUrl: (0, utils_1.getAvatarUrl)(row.avatar_url, row.id),
            blockedAt: row.blocked_at
        }));
    }
};
