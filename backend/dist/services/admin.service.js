"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminService = void 0;
const database_1 = require("../config/database");
const notification_model_1 = require("../models/mongoose/notification.model");
const post_model_1 = require("../models/mongoose/post.model");
const comment_model_1 = require("../models/mongoose/comment.model");
const utils_1 = require("../utils");
exports.adminService = {
    getReports: async (status, type, page, limit) => {
        const offset = (page - 1) * limit;
        let query = `
      SELECT r.*, 
             u_reporter.username as reporter_username,
             u_reporter.first_name as reporter_first_name,
             u_reporter.last_name as reporter_last_name,
             u_reported.username as reported_username
      FROM content_reports r
      LEFT JOIN users u_reporter ON r.reporter_id = u_reporter.id
      LEFT JOIN users u_reported ON r.reported_user_id = u_reported.id
      WHERE r.status = $1
    `;
        const params = [status];
        let paramIndex = 2;
        if (type) {
            query += ` AND r.content_type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }
        query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        const result = await database_1.pgPool.query(query, params);
        return result.rows.map(row => ({
            id: row.id,
            contentType: row.content_type,
            contentId: row.content_id,
            reason: row.reason,
            description: row.description,
            status: row.status,
            reporter: {
                id: row.reporter_id,
                username: row.reporter_username,
                name: `${row.reporter_first_name} ${row.reporter_last_name}`
            },
            reportedUser: row.reported_user_id ? {
                id: row.reported_user_id,
                username: row.reported_username
            } : null,
            createdAt: row.created_at,
            resolvedAt: row.resolved_at
        }));
    },
    reportContent: async (reporterId, contentType, contentId, reason, description) => {
        const existingReport = await database_1.pgPool.query(`
      SELECT id FROM content_reports 
      WHERE reporter_id = $1 AND content_type = $2 AND content_id = $3 AND status = 'pending'
    `, [reporterId, contentType, contentId]);
        if (existingReport.rows.length > 0) {
            throw new Error('Content already reported');
        }
        let reportedUserId = null;
        switch (contentType) {
            case 'post':
                const post = await post_model_1.Post.findOne({ _id: contentId });
                reportedUserId = post?.userId;
                break;
            case 'comment':
                const comment = await comment_model_1.Comment.findOne({ _id: contentId });
                reportedUserId = comment?.userId;
                break;
            case 'user':
                reportedUserId = contentId;
                break;
            case 'item':
                const item = await database_1.pgPool.query('SELECT seller_id FROM store_items WHERE id = $1', [contentId]);
                reportedUserId = item.rows[0]?.seller_id;
                break;
            case 'event':
                const event = await database_1.pgPool.query('SELECT organizer_id FROM events WHERE id = $1', [contentId]);
                reportedUserId = event.rows[0]?.organizer_id;
                break;
        }
        await database_1.pgPool.query(`
      INSERT INTO content_reports (
        reporter_id, reported_user_id, content_type, content_id,
        reason, description, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
    `, [reporterId, reportedUserId, contentType, contentId, reason, description]);
    },
    resolveReport: async (reportId, action, notes, adminId) => {
        const reportResult = await database_1.pgPool.query(`
      SELECT * FROM content_reports WHERE id = $1
    `, [reportId]);
        if (reportResult.rows.length === 0) {
            throw new Error('Report not found');
        }
        const report = reportResult.rows[0];
        switch (action) {
            case 'remove_content':
                await exports.adminService.removeReportedContent(report);
                break;
            case 'suspend_user':
                await exports.adminService.suspendUser(report.reported_user_id, 'Content violation', 7); // 7 days suspension
                break;
            case 'warn':
                await exports.adminService.sendWarningToUser(report.reported_user_id, report.reason, notes);
                break;
        }
        await database_1.pgPool.query(`
      UPDATE content_reports 
      SET status = 'resolved', 
          resolved_by = $1,
          resolved_at = CURRENT_TIMESTAMP,
          action_taken = $2,
          admin_notes = $3
      WHERE id = $4
    `, [adminId, action, notes, reportId]);
    },
    removeReportedContent: async (report) => {
        switch (report.content_type) {
            case 'post':
                await post_model_1.Post.updateOne({ _id: report.content_id }, { $set: { deletedAt: new Date() } });
                break;
            case 'comment':
                await comment_model_1.Comment.updateOne({ _id: report.content_id }, { $set: { deletedAt: new Date() } });
                break;
            case 'item':
                await database_1.pgPool.query('UPDATE store_items SET status = $1, deleted_at = CURRENT_TIMESTAMP WHERE id = $2', ['removed', report.content_id]);
                break;
            case 'event':
                await database_1.pgPool.query('UPDATE events SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [report.content_id]);
                break;
        }
    },
    suspendUser: async (userId, reason, days) => {
        const suspensionEnd = new Date();
        suspensionEnd.setDate(suspensionEnd.getDate() + days);
        await database_1.pgPool.query(`
      UPDATE users 
      SET suspended_until = $1, suspension_reason = $2
      WHERE id = $3
    `, [suspensionEnd, reason, userId]);
        await notification_model_1.Notification.create({
            userId,
            type: 'system',
            message: `Your account has been suspended until ${suspensionEnd.toDateString()}. Reason: ${reason}`
        });
    },
    sendWarningToUser: async (userId, reason, notes) => {
        await notification_model_1.Notification.create({
            userId,
            type: 'system',
            message: `You have received a warning: ${reason}. ${notes ? `Additional notes: ${notes}` : ''}`
        });
    },
    getPlatformStatistics: async (period) => {
        let startDate = new Date();
        switch (period) {
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            case 'all':
                startDate = new Date(0); // Beginning of time
                break;
        }
        const userStats = await database_1.pgPool.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at >= $1 THEN 1 END) as new_users,
        COUNT(CASE WHEN subscription_tier = 'premium' THEN 1 END) as premium_users,
        COUNT(CASE WHEN suspended_until IS NOT NULL AND suspended_until > CURRENT_TIMESTAMP THEN 1 END) as suspended_users
      FROM users
      WHERE deleted_at IS NULL
    `, [startDate]);
        const postStats = await post_model_1.Post.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    deletedAt: null
                }
            },
            {
                $group: {
                    _id: null,
                    totalPosts: { $sum: 1 },
                    totalLikes: { $sum: '$likesCount' },
                    totalComments: { $sum: '$commentsCount' },
                    avgEngagement: { $avg: { $add: ['$likesCount', '$commentsCount'] } }
                }
            }
        ]);
        const storeStats = await database_1.pgPool.query(`
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN created_at >= $1 THEN 1 END) as new_items,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_items,
        COALESCE(SUM(CASE WHEN status = 'sold' THEN price END), 0) as total_sales
      FROM store_items
      WHERE deleted_at IS NULL
    `, [startDate]);
        const eventStats = await database_1.pgPool.query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN created_at >= $1 THEN 1 END) as new_events,
        SUM(current_attendees) as total_attendees
      FROM events
      WHERE deleted_at IS NULL
    `, [startDate]);
        return {
            users: userStats.rows[0],
            posts: postStats[0] || { totalPosts: 0, totalLikes: 0, totalComments: 0, avgEngagement: 0 },
            store: storeStats.rows[0],
            events: eventStats.rows[0]
        };
    },
    getUserManagementList: async (search, role, status, page = 1, limit = 50) => {
        const offset = (page - 1) * limit;
        let query = `
      SELECT id, username, email, first_name, last_name, avatar_url,
             faculty, subscription_tier, suspended_until,
             followers_count, following_count, posts_count,
             created_at, last_login_at
      FROM users
      WHERE deleted_at IS NULL
    `;
        const params = [];
        let paramIndex = 1;
        if (search) {
            query += ` AND (username ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        if (role && role !== 'all') {
            query += ` AND subscription_tier = $${paramIndex}`;
            params.push(role);
            paramIndex++;
        }
        if (status === 'suspended') {
            query += ` AND suspended_until IS NOT NULL AND suspended_until > CURRENT_TIMESTAMP`;
        }
        else if (status === 'active') {
            query += ` AND (suspended_until IS NULL OR suspended_until <= CURRENT_TIMESTAMP)`;
        }
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);
        const result = await database_1.pgPool.query(query, params);
        return result.rows.map(row => ({
            id: row.id,
            username: row.username,
            email: row.email,
            name: `${row.first_name} ${row.last_name}`,
            avatarUrl: (0, utils_1.getAvatarUrl)(row.avatar_url, row.id),
            faculty: row.faculty,
            subscriptionTier: row.subscription_tier,
            isSuspended: row.suspended_until && row.suspended_until > new Date(),
            suspendedUntil: row.suspended_until,
            stats: {
                followers: row.followers_count,
                following: row.following_count,
                posts: row.posts_count
            },
            createdAt: row.created_at,
            lastLogin: row.last_login_at
        }));
    },
    getThemeAnalytics: async (period) => {
        let startDate = new Date();
        switch (period) {
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            case 'all':
                startDate = new Date(0);
                break;
        }
        // Theme preference distribution
        const themeStats = await database_1.pgPool.query(`
      SELECT
        theme_preference,
        COUNT(*) as count,
        COUNT(CASE WHEN dark_mode_preference = true THEN 1 END) as dark_mode_users,
        COUNT(CASE WHEN dark_mode_preference = false THEN 1 END) as light_mode_users
      FROM users
      WHERE created_at >= $1 AND deleted_at IS NULL
      GROUP BY theme_preference
      ORDER BY count DESC
    `, [startDate]);
        // Daily theme changes over time
        const dailyChanges = await database_1.pgPool.query(`
      SELECT
        DATE(updated_at) as date,
        COUNT(*) as changes
      FROM users
      WHERE updated_at >= $1 AND deleted_at IS NULL
      GROUP BY DATE(updated_at)
      ORDER BY date DESC
    `, [startDate]);
        return {
            themeDistribution: themeStats.rows,
            dailyChanges: dailyChanges.rows,
            period
        };
    },
    getThemeUsageStats: async () => {
        const totalUsers = await database_1.pgPool.query('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL');
        const themeUsers = await database_1.pgPool.query('SELECT COUNT(*) as count FROM users WHERE theme_preference IS NOT NULL AND deleted_at IS NULL');
        const darkModeUsers = await database_1.pgPool.query('SELECT COUNT(*) as count FROM users WHERE dark_mode_preference = true AND deleted_at IS NULL');
        const themeBreakdown = await database_1.pgPool.query(`
      SELECT theme_preference, COUNT(*) as count
      FROM users
      WHERE theme_preference IS NOT NULL AND deleted_at IS NULL
      GROUP BY theme_preference
      ORDER BY count DESC
    `);
        return {
            totalUsers: parseInt(totalUsers.rows[0].count),
            usersWithThemes: parseInt(themeUsers.rows[0].count),
            darkModeUsers: parseInt(darkModeUsers.rows[0].count),
            themeBreakdown: themeBreakdown.rows,
            adoptionRate: parseInt(themeUsers.rows[0].count) / parseInt(totalUsers.rows[0].count)
        };
    },
    setDefaultTheme: async (themeId, darkMode, adminId) => {
        // This would typically update a system-wide default theme setting
        // For now, we'll just log the admin action
        console.log(`Admin ${adminId} set default theme to ${themeId} with dark mode ${darkMode}`);
        // In a production system, you might store this in a settings table
        // await pgPool.query('UPDATE system_settings SET default_theme = $1, default_dark_mode = $2', [themeId, darkMode]);
    }
};
