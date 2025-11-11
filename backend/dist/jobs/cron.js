"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeBackgroundJobs = initializeBackgroundJobs;
// Use require for node-cron to avoid missing declaration issues under ts-node runtime
const cron = require('node-cron');
const database_1 = require("../config/database");
const notification_model_1 = require("../models/mongoose/notification.model");
const post_model_1 = require("../models/mongoose/post.model");
const comment_model_1 = require("../models/mongoose/comment.model");
const like_model_1 = require("../models/mongoose/like.model");
const story_model_1 = require("../models/mongoose/story.model");
const index_1 = require("../utils/index"); // Assuming sendEmail is in utils
const analytics_cron_1 = require("./analytics-cron");
const backup_service_1 = require("../services/backup.service");
const offline_queue_service_1 = __importDefault(require("../services/offline-queue.service"));
const offline_data_service_1 = __importDefault(require("../services/offline-data.service"));
const sync_conflict_service_1 = __importDefault(require("../services/sync-conflict.service"));
// Initialize background jobs
function initializeBackgroundJobs() {
    console.log('🕒 Initializing background jobs...');
    // Clean up expired stories every hour
    cron.schedule('0 * * * *', cleanupExpiredStories);
    // Calculate rankings every Sunday at 2 AM
    cron.schedule('0 2 * * 0', calculateWeeklyRankings);
    // Reset monthly rankings on 1st of month at 3 AM
    cron.schedule('0 3 1 * *', resetMonthlyRankings);
    // Check and expire subscriptions daily at 4 AM
    cron.schedule('0 4 * * *', checkSubscriptionExpirations);
    // Send weekly digest emails every Monday at 9 AM
    cron.schedule('0 9 * * 1', sendWeeklyDigests);
    // Clean up old notifications weekly
    cron.schedule('0 5 * * 0', cleanupOldNotifications);
    // Analytics jobs
    // Aggregate daily metrics every day at 1 AM
    cron.schedule('0 1 * * *', analytics_cron_1.AnalyticsCronJobs.aggregateDailyMetrics);
    // Generate weekly reports every Monday at 2 AM
    cron.schedule('0 2 * * 1', analytics_cron_1.AnalyticsCronJobs.generateWeeklyReports);
    // Generate monthly reports on 1st of month at 3 AM
    cron.schedule('0 3 1 * *', analytics_cron_1.AnalyticsCronJobs.generateMonthlyReports);
    // Update real-time cache every 15 minutes
    cron.schedule('*/15 * * * *', analytics_cron_1.AnalyticsCronJobs.updateRealtimeCache);
    // Clean up old analytics data monthly
    cron.schedule('0 4 1 * *', analytics_cron_1.AnalyticsCronJobs.cleanupOldAnalyticsData);
    // Offline sync jobs
    // Process offline queues every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        try {
            console.log('🔄 Processing offline queues...');
            // Get all users with pending queue items
            const usersWithQueues = await database_1.pgPool.query(`
        SELECT DISTINCT user_id
        FROM offline_queues
        WHERE status IN ('pending', 'processing')
        LIMIT 100
      `);
            let totalProcessed = 0;
            let totalFailed = 0;
            for (const user of usersWithQueues.rows) {
                try {
                    await offline_queue_service_1.default.processQueue(user.user_id);
                    totalProcessed++;
                }
                catch (error) {
                    console.error(`Failed to process queue for user ${user.user_id}:`, error);
                    totalFailed++;
                }
            }
            console.log(`✅ Processed queues for ${totalProcessed} users, ${totalFailed} failed`);
        }
        catch (error) {
            console.error('❌ Offline queue processing failed:', error);
        }
    });
    // Sync offline data every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
        try {
            console.log('🔄 Syncing offline data...');
            // Get users with offline data to sync
            const usersWithOfflineData = await database_1.pgPool.query(`
        SELECT DISTINCT user_id
        FROM offline_data
        WHERE sync_status IN ('pending', 'error')
        LIMIT 50
      `);
            let totalSynced = 0;
            let totalConflicts = 0;
            let totalErrors = 0;
            for (const user of usersWithOfflineData.rows) {
                try {
                    const result = await offline_data_service_1.default.syncOfflineData(user.user_id);
                    totalSynced += result.synced;
                    totalConflicts += result.conflicts;
                    totalErrors += result.errors;
                }
                catch (error) {
                    console.error(`Failed to sync offline data for user ${user.user_id}:`, error);
                    totalErrors++;
                }
            }
            console.log(`✅ Synced ${totalSynced} items, ${totalConflicts} conflicts, ${totalErrors} errors`);
        }
        catch (error) {
            console.error('❌ Offline data sync failed:', error);
        }
    });
    // Clean up expired offline data daily
    cron.schedule('0 1 * * *', async () => {
        try {
            console.log('🧹 Cleaning up offline data...');
            // Clean up expired offline data
            const expiredCount = await offline_data_service_1.default.cleanupExpiredData();
            // Clean up old resolved conflicts
            const conflictsCleaned = await sync_conflict_service_1.default.cleanupResolvedConflicts();
            // Clean up old queue items
            const usersWithQueues = await database_1.pgPool.query(`
        SELECT DISTINCT user_id
        FROM offline_queues
        WHERE status IN ('completed', 'failed')
        AND updated_at < NOW() - INTERVAL '30 days'
      `);
            let queueItemsCleaned = 0;
            for (const user of usersWithQueues.rows) {
                const cleaned = await offline_queue_service_1.default.cleanupOldItems(user.user_id);
                queueItemsCleaned += cleaned;
            }
            console.log(`🗑️ Cleaned up ${expiredCount} expired items, ${conflictsCleaned} old conflicts, ${queueItemsCleaned} old queue items`);
        }
        catch (error) {
            console.error('❌ Offline data cleanup failed:', error);
        }
    });
    // Retry failed sync operations hourly
    cron.schedule('0 * * * *', async () => {
        try {
            console.log('🔄 Retrying failed sync operations...');
            // Get users with failed sync operations
            const usersWithFailedSyncs = await database_1.pgPool.query(`
        SELECT DISTINCT user_id
        FROM offline_queues
        WHERE status = 'failed'
        AND retry_count < max_retries
        LIMIT 50
      `);
            let totalRetried = 0;
            for (const user of usersWithFailedSyncs.rows) {
                try {
                    const retried = await offline_queue_service_1.default.retryFailedItems(user.user_id);
                    totalRetried += retried;
                }
                catch (error) {
                    console.error(`Failed to retry syncs for user ${user.user_id}:`, error);
                }
            }
            console.log(`✅ Retried ${totalRetried} failed sync operations`);
        }
        catch (error) {
            console.error('❌ Failed sync retry failed:', error);
        }
    });
    // Backup jobs
    // Daily full backup at 2 AM
    cron.schedule('0 2 * * *', performDailyBackup);
    // Clean up expired backups weekly
    cron.schedule('0 3 * * 0', cleanupExpiredBackups);
    // Verify backup integrity weekly
    cron.schedule('0 4 * * 0', verifyBackupIntegrity);
    console.log('✅ Background jobs initialized');
}
// Clean up expired stories
async function cleanupExpiredStories() {
    try {
        const result = await story_model_1.Story.deleteMany({
            expiresAt: { $lt: new Date() }
        });
        console.log(`🧹 Cleaned up ${result.deletedCount} expired stories`);
    }
    catch (error) {
        console.error('Story cleanup error:', error);
    }
}
// Calculate weekly rankings
async function calculateWeeklyRankings() {
    try {
        console.log('🏆 Calculating weekly rankings...');
        // Get top users by weekly score
        const topUsers = await database_1.pgPool.query(`
      SELECT us.user_id, us.weekly_score, u.username, u.first_name, u.last_name,
             u.avatar_url, u.subscription_tier
      FROM user_scores us
      JOIN users u ON us.user_id = u.id
      WHERE u.subscription_tier = 'premium'
      ORDER BY us.weekly_score DESC
      LIMIT 100
    `);
        // Store weekly rankings
        const rankingDate = new Date();
        const rankingPeriod = `weekly-${rankingDate.toISOString().split('T')[0]}`;
        for (let i = 0; i < topUsers.rows.length; i++) {
            const user = topUsers.rows[i];
            await database_1.pgPool.query(`
        INSERT INTO ranking_history (user_id, ranking_period, rank, score, ranking_type)
        VALUES ($1, $2, $3, $4, 'weekly')
        ON CONFLICT (user_id, ranking_period, ranking_type) 
        DO UPDATE SET rank = $3, score = $4
      `, [user.user_id, rankingPeriod, i + 1, user.weekly_score]);
        }
        // Reset weekly scores for next period
        await database_1.pgPool.query(`
      UPDATE user_scores 
      SET weekly_score = 0,
          last_weekly_reset = CURRENT_TIMESTAMP
    `);
        console.log(`✅ Weekly rankings calculated for ${topUsers.rows.length} users`);
        // Award prizes to top 3
        if (topUsers.rows.length >= 3) {
            await awardRankingPrizes(topUsers.rows.slice(0, 3), 'weekly');
        }
    }
    catch (error) {
        console.error('Weekly rankings error:', error);
    }
}
// Reset monthly rankings
async function resetMonthlyRankings() {
    try {
        console.log('📊 Resetting monthly rankings...');
        // Store final monthly rankings
        const rankingDate = new Date();
        const previousMonth = new Date(rankingDate.getFullYear(), rankingDate.getMonth() - 1, 1);
        const rankingPeriod = `monthly-${previousMonth.getFullYear()}-${previousMonth.getMonth() + 1}`;
        const topUsers = await database_1.pgPool.query(`
      SELECT us.user_id, us.monthly_score, u.username
      FROM user_scores us
      JOIN users u ON us.user_id = u.id
      WHERE u.subscription_tier = 'premium'
      ORDER BY us.monthly_score DESC
      LIMIT 50
    `);
        for (let i = 0; i < topUsers.rows.length; i++) {
            const user = topUsers.rows[i];
            await database_1.pgPool.query(`
        INSERT INTO ranking_history (user_id, ranking_period, rank, score, ranking_type)
        VALUES ($1, $2, $3, $4, 'monthly')
      `, [user.user_id, rankingPeriod, i + 1, user.monthly_score]);
        }
        // Reset monthly scores
        await database_1.pgPool.query(`
      UPDATE user_scores 
      SET monthly_score = 0,
          last_monthly_reset = CURRENT_TIMESTAMP
    `);
        console.log(`✅ Monthly rankings reset for ${topUsers.rows.length} users`);
        // Award monthly prizes
        if (topUsers.rows.length >= 3) {
            await awardRankingPrizes(topUsers.rows.slice(0, 3), 'monthly');
        }
    }
    catch (error) {
        console.error('Monthly rankings reset error:', error);
    }
}
// Award ranking prizes
async function awardRankingPrizes(topUsers, period) {
    try {
        const prizes = period === 'weekly'
            ? [75.00, 45.00, 30.00] // Weekly prizes in GHS
            : [300.00, 180.00, 120.00]; // Monthly prizes
        for (let i = 0; i < Math.min(topUsers.length, 3); i++) {
            const user = topUsers[i];
            const prizeAmount = prizes[i];
            // Create prize record
            await database_1.pgPool.query(`
        INSERT INTO ranking_prizes (user_id, ranking_period, rank, prize_amount, prize_type)
        VALUES ($1, $2, $3, $4, $5)
      `, [user.user_id, `${period}-${new Date().toISOString().split('T')[0]}`, i + 1, prizeAmount, period]);
            // Create notification for winner
            await notification_model_1.Notification.create({
                userId: user.user_id,
                type: 'ranking_prize',
                message: `Congratulations! You ranked #${i + 1} in the ${period} rankings and won ₵${prizeAmount}`
            });
            console.log(`🎉 Awarded ₵${prizeAmount} to ${user.username} for ${period} rank ${i + 1}`);
        }
    }
    catch (error) {
        console.error('Award prizes error:', error);
    }
}
// Check subscription expirations
async function checkSubscriptionExpirations() {
    try {
        console.log('💰 Checking subscription expirations...');
        const expiringUsers = await database_1.pgPool.query(`
      SELECT id, username, email, subscription_tier, subscription_expires_at
      FROM users
      WHERE subscription_tier = 'premium'
      AND subscription_expires_at BETWEEN CURRENT_TIMESTAMP AND (CURRENT_TIMESTAMP + INTERVAL '3 days')
      AND deleted_at IS NULL
    `);
        for (const user of expiringUsers.rows) {
            // Send expiration reminder
            await notification_model_1.Notification.create({
                userId: user.id,
                type: 'subscription_reminder',
                message: `Your premium subscription expires on ${new Date(user.subscription_expires_at).toLocaleDateString()}. Renew to keep your benefits!`
            });
            console.log(`📧 Sent subscription reminder to ${user.username}`);
        }
        // Downgrade expired subscriptions
        const expiredUsers = await database_1.pgPool.query(`
      UPDATE users 
      SET subscription_tier = 'free',
          subscription_expires_at = NULL
      WHERE subscription_tier = 'premium'
      AND subscription_expires_at < CURRENT_TIMESTAMP
      AND deleted_at IS NULL
      RETURNING id, username
    `);
        if (expiredUsers.rows.length > 0) {
            console.log(`🔻 Downgraded ${expiredUsers.rows.length} expired subscriptions`);
            for (const user of expiredUsers.rows) {
                await notification_model_1.Notification.create({
                    userId: user.id,
                    type: 'subscription_expired',
                    message: 'Your premium subscription has expired. Upgrade to regain access to premium features.'
                });
            }
        }
    }
    catch (error) {
        console.error('Subscription expiration check error:', error);
    }
}
// Send weekly digest emails
async function sendWeeklyDigests() {
    try {
        console.log('📨 Sending weekly digests...');
        // Get users who want digest emails (would need email_preferences table)
        const users = await database_1.pgPool.query(`
      SELECT id, username, email, first_name
      FROM users
      WHERE deleted_at IS NULL
      AND email IS NOT NULL
      LIMIT 1000 -- Batch processing
    `);
        for (const user of users.rows) {
            try {
                // Get user's weekly stats
                const userStats = await getUserWeeklyStats(user.id);
                // Send digest email
                await (0, index_1.sendEmail)(user.email, 'Your Raved Weekly Digest', `
          <h2>Hello ${user.first_name}!</h2>
          <p>Here's your weekly Raved digest:</p>
          <ul>
            <li>New followers: ${userStats.newFollowers}</li>
            <li>Posts liked: ${userStats.postsLiked}</li>
            <li>Comments received: ${userStats.commentsReceived}</li>
            <li>Top trending in your network: ${userStats.trendingPosts} posts</li>
          </ul>
          <p><a href="https://raved.app">View your profile</a></p>
        `);
                console.log(`📧 Sent weekly digest to ${user.email}`);
            }
            catch (error) {
                console.error(`Failed to send digest to ${user.email}:`, error);
            }
        }
    }
    catch (error) {
        console.error('Weekly digest error:', error);
    }
}
// Clean up old notifications
async function cleanupOldNotifications() {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep 30 days
        const result = await notification_model_1.Notification.deleteMany({
            createdAt: { $lt: cutoffDate },
            isRead: true
        });
        console.log(`🗑️ Cleaned up ${result.deletedCount} old notifications`);
    }
    catch (error) {
        console.error('Notification cleanup error:', error);
    }
}
// Get user weekly stats for digest
async function getUserWeeklyStats(userId) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newFollowers = await database_1.pgPool.query('SELECT COUNT(*) FROM connections WHERE following_id = $1 AND created_at >= $2', [userId, oneWeekAgo]);
    const postsLiked = await like_model_1.Like.countDocuments({
        userId,
        targetType: 'post',
        createdAt: { $gte: oneWeekAgo }
    });
    const commentsReceived = await comment_model_1.Comment.countDocuments({
        userId,
        createdAt: { $gte: oneWeekAgo }
    });
    // Simplified trending posts count
    const trendingPosts = await post_model_1.Post.countDocuments({
        createdAt: { $gte: oneWeekAgo },
        likesCount: { $gte: 10 }
    });
    return {
        newFollowers: parseInt(newFollowers.rows[0].count),
        postsLiked,
        commentsReceived,
        trendingPosts
    };
}
// Backup job functions
async function performDailyBackup() {
    try {
        console.log('🔄 Starting daily backup...');
        const metadata = await backup_service_1.backupService.createFullBackup({
            compress: true,
            retentionDays: 30
        });
        console.log(`✅ Daily backup completed: ${metadata.id}`);
    }
    catch (error) {
        console.error('❌ Daily backup failed:', error);
    }
}
async function cleanupExpiredBackups() {
    try {
        console.log('🧹 Cleaning up expired backups...');
        const deletedCount = await backup_service_1.backupService.deleteExpiredBackups();
        console.log(`🗑️ Cleaned up ${deletedCount} expired backups`);
    }
    catch (error) {
        console.error('❌ Backup cleanup failed:', error);
    }
}
async function verifyBackupIntegrity() {
    try {
        console.log('🔍 Verifying backup integrity...');
        const backups = await backup_service_1.backupService.listBackups();
        let verifiedCount = 0;
        let failedCount = 0;
        for (const backup of backups) {
            try {
                const isValid = await backup_service_1.backupService.verifyBackupIntegrity(backup.id);
                if (isValid) {
                    verifiedCount++;
                }
                else {
                    failedCount++;
                    console.error(`❌ Backup integrity check failed for ${backup.id}`);
                }
            }
            catch (error) {
                failedCount++;
                console.error(`❌ Error verifying backup ${backup.id}:`, error);
            }
        }
        console.log(`✅ Verified ${verifiedCount} backups, ${failedCount} failed`);
    }
    catch (error) {
        console.error('❌ Backup integrity verification failed:', error);
    }
}
