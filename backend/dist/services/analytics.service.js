"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsService = exports.AnalyticsService = void 0;
const database_1 = require("../config/database");
const logging_middleware_1 = require("../middleware/logging.middleware");
class AnalyticsService {
    // Event tracking methods
    async trackEvent(event) {
        try {
            await database_1.pgPool.query(`
        INSERT INTO analytics_events (
          user_id, session_id, event_type, event_category, event_action,
          event_label, event_value, page_url, page_title, referrer,
          user_agent, ip_address, device_type, browser, os,
          screen_resolution, viewport_size, timestamp, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      `, [
                event.user_id,
                event.session_id,
                event.event_type,
                event.event_category,
                event.event_action,
                event.event_label,
                event.event_value,
                event.page_url,
                event.page_title,
                event.referrer,
                event.user_agent,
                event.ip_address,
                event.device_type,
                event.browser,
                event.os,
                event.screen_resolution,
                event.viewport_size,
                event.timestamp,
                JSON.stringify(event.metadata || {})
            ]);
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to track event', error);
            throw error;
        }
    }
    // Metric tracking methods
    async updateMetric(metric) {
        try {
            await database_1.pgPool.query(`
        INSERT INTO analytics_metrics (
          metric_name, metric_value, metric_type, tags, timestamp
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
                metric.metric_name,
                metric.metric_value,
                metric.metric_type,
                JSON.stringify(metric.tags),
                metric.timestamp
            ]);
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to update metric', error);
            throw error;
        }
    }
    // Real-time analytics with caching
    async getRealtimeMetrics(timeRangeMinutes = 60) {
        try {
            const cacheKey = `analytics:realtime:${timeRangeMinutes}`;
            const cached = await database_1.redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
            const startTime = new Date(Date.now() - timeRangeMinutes * 60 * 1000);
            const [eventsResult, usersResult, pageViewsResult] = await Promise.all([
                database_1.pgPool.query(`
          SELECT
            event_type,
            event_category,
            COUNT(*) as count,
            AVG(event_value) as avg_value
          FROM analytics_events
          WHERE timestamp >= $1
          GROUP BY event_type, event_category
          ORDER BY count DESC
        `, [startTime]),
                database_1.pgPool.query(`
          SELECT COUNT(DISTINCT user_id) as active_users
          FROM analytics_events
          WHERE timestamp >= $1 AND user_id IS NOT NULL
        `, [startTime]),
                database_1.pgPool.query(`
          SELECT page_url, COUNT(*) as views
          FROM analytics_events
          WHERE timestamp >= $1 AND event_type = 'page_view'
          GROUP BY page_url
          ORDER BY views DESC
          LIMIT 10
        `, [startTime])
            ]);
            const metrics = {
                events: eventsResult.rows,
                activeUsers: usersResult.rows[0]?.active_users || 0,
                topPages: pageViewsResult.rows,
                timeRange: `${timeRangeMinutes} minutes`,
                timestamp: new Date().toISOString()
            };
            // Cache for 5 minutes
            await database_1.redis.setex(cacheKey, 300, JSON.stringify(metrics));
            return metrics;
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to get realtime metrics', error);
            throw error;
        }
    }
    // User activity logging
    async logUserActivity(activity) {
        try {
            await database_1.pgPool.query(`
        INSERT INTO user_activity_logs (
          user_id, activity_type, activity_data, ip_address, user_agent, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
                activity.user_id,
                activity.activity_type,
                JSON.stringify(activity.activity_data),
                activity.ip_address,
                activity.user_agent,
                activity.timestamp
            ]);
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to log user activity', error);
            throw error;
        }
    }
    // Get user activity history
    async getUserActivityHistory(userId, limit = 50, offset = 0) {
        try {
            const result = await database_1.pgPool.query(`
        SELECT * FROM user_activity_logs
        WHERE user_id = $1
        ORDER BY timestamp DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);
            return result.rows.map(row => ({
                ...row,
                activity_data: typeof row.activity_data === 'string'
                    ? JSON.parse(row.activity_data)
                    : row.activity_data
            }));
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to get user activity history', error);
            throw error;
        }
    }
    // Generate analytics reports
    async generateReport(reportType, dateRangeStart, dateRangeEnd) {
        try {
            const reportData = await this.calculateReportData(reportType, dateRangeStart, dateRangeEnd);
            const report = {
                report_type: reportType,
                report_name: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Analytics Report`,
                date_range_start: dateRangeStart,
                date_range_end: dateRangeEnd,
                data: reportData,
                generated_at: new Date()
            };
            const result = await database_1.pgPool.query(`
        INSERT INTO analytics_reports (
          report_type, report_name, date_range_start, date_range_end, data, generated_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
                report.report_type,
                report.report_name,
                report.date_range_start,
                report.date_range_end,
                JSON.stringify(report.data),
                report.generated_at
            ]);
            return {
                ...result.rows[0],
                data: typeof result.rows[0].data === 'string'
                    ? JSON.parse(result.rows[0].data)
                    : result.rows[0].data
            };
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to generate report', error);
            throw error;
        }
    }
    async calculateReportData(reportType, startDate, endDate) {
        const [userStats, eventStats, pageStats, deviceStats, conversionStats] = await Promise.all([
            this.getUserStats(startDate, endDate),
            this.getEventStats(startDate, endDate),
            this.getPageStats(startDate, endDate),
            this.getDeviceStats(startDate, endDate),
            this.getConversionStats(startDate, endDate)
        ]);
        return {
            userStats,
            eventStats,
            pageStats,
            deviceStats,
            conversionStats,
            generatedAt: new Date().toISOString()
        };
    }
    async getUserStats(startDate, endDate) {
        const result = await database_1.pgPool.query(`
      SELECT
        COUNT(DISTINCT user_id) as total_users,
        COUNT(DISTINCT CASE WHEN timestamp >= $3 THEN user_id END) as new_users,
        COUNT(DISTINCT CASE WHEN timestamp >= $4 THEN user_id END) as active_users
      FROM analytics_events
      WHERE timestamp BETWEEN $1 AND $2 AND user_id IS NOT NULL
    `, [
            startDate,
            endDate,
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        ]);
        return result.rows[0];
    }
    async getEventStats(startDate, endDate) {
        const result = await database_1.pgPool.query(`
      SELECT
        event_type,
        event_category,
        COUNT(*) as count,
        AVG(event_value) as avg_value,
        SUM(event_value) as total_value
      FROM analytics_events
      WHERE timestamp BETWEEN $1 AND $2
      GROUP BY event_type, event_category
      ORDER BY count DESC
    `, [startDate, endDate]);
        return result.rows;
    }
    async getPageStats(startDate, endDate) {
        const result = await database_1.pgPool.query(`
      SELECT
        page_url,
        COUNT(*) as views,
        COUNT(DISTINCT session_id) as unique_views,
        AVG(event_value) as avg_time_spent
      FROM analytics_events
      WHERE timestamp BETWEEN $1 AND $2 AND event_type = 'page_view'
      GROUP BY page_url
      ORDER BY views DESC
      LIMIT 20
    `, [startDate, endDate]);
        return result.rows;
    }
    async getDeviceStats(startDate, endDate) {
        const result = await database_1.pgPool.query(`
      SELECT
        device_type,
        browser,
        os,
        COUNT(*) as count
      FROM analytics_events
      WHERE timestamp BETWEEN $1 AND $2
      GROUP BY device_type, browser, os
      ORDER BY count DESC
    `, [startDate, endDate]);
        return result.rows;
    }
    async getConversionStats(startDate, endDate) {
        const result = await database_1.pgPool.query(`
      SELECT
        event_action as conversion_type,
        COUNT(*) as count,
        SUM(event_value) as total_value
      FROM analytics_events
      WHERE timestamp BETWEEN $1 AND $2 AND event_type = 'conversion'
      GROUP BY event_action
      ORDER BY count DESC
    `, [startDate, endDate]);
        return result.rows;
    }
    // A/B Testing methods
    async createABTest(test) {
        try {
            const result = await database_1.pgPool.query(`
        INSERT INTO ab_tests (
          test_name, test_description, feature_name, variants, weights, start_date, end_date, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
                test.test_name,
                test.test_description,
                test.feature_name,
                test.variants,
                test.weights,
                test.start_date,
                test.end_date,
                test.status
            ]);
            return result.rows[0];
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to create A/B test', error);
            throw error;
        }
    }
    async getVariantForUser(testName, userId) {
        try {
            // Check if user already has a variant assigned
            const existingResult = await database_1.pgPool.query(`
        SELECT abt.variants[abr.variant_index] as variant
        FROM ab_test_results abr
        JOIN ab_tests abt ON abr.test_id = abt.id
        WHERE abt.test_name = $1 AND abr.user_id = $2
        LIMIT 1
      `, [testName, userId]);
            if (existingResult.rows.length > 0) {
                return existingResult.rows[0].variant;
            }
            // Get test configuration
            const testResult = await database_1.pgPool.query(`
        SELECT id, variants, weights, status
        FROM ab_tests
        WHERE test_name = $1 AND status = 'active'
        AND start_date <= NOW() AND (end_date IS NULL OR end_date >= NOW())
      `, [testName]);
            if (testResult.rows.length === 0) {
                throw new Error('A/B test not found or not active');
            }
            const test = testResult.rows[0];
            const variantIndex = this.selectVariantByWeight(test.weights || test.variants.map(() => 1));
            const variant = test.variants[variantIndex];
            // Record the assignment
            await database_1.pgPool.query(`
        INSERT INTO ab_test_results (
          test_id, variant_name, user_id, event_type, timestamp
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
                test.id,
                variant,
                userId,
                'variant_assigned',
                new Date()
            ]);
            return variant;
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to get variant for user', error);
            throw error;
        }
    }
    selectVariantByWeight(weights) {
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        for (let i = 0; i < weights.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return i;
            }
        }
        return 0; // Fallback
    }
    async trackABTestResult(testName, userId, eventType, eventValue) {
        try {
            const result = await database_1.pgPool.query(`
        INSERT INTO ab_test_results (
          test_id, variant_name, user_id, event_type, event_value, timestamp
        ) SELECT
          abt.id,
          abt.variants[abr.variant_index],
          $3,
          $4,
          $5,
          NOW()
        FROM ab_tests abt
        JOIN ab_test_results abr ON abr.test_id = abt.id
        WHERE abt.test_name = $1 AND abr.user_id = $3
        LIMIT 1
      `, [testName, userId, eventType, eventValue]);
            if (result.rowCount === 0) {
                logging_middleware_1.logger.warn('No variant found for user in A/B test', { testName, userId });
            }
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to track A/B test result', error);
            throw error;
        }
    }
    // Data aggregation and cleanup methods
    async aggregateDailyMetrics() {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
            const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
            // Aggregate daily active users
            await database_1.pgPool.query(`
        INSERT INTO analytics_metrics (metric_name, metric_value, metric_type, tags, timestamp)
        SELECT
          'daily_active_users',
          COUNT(DISTINCT user_id),
          'gauge',
          '{"period": "daily"}',
          $1
        FROM analytics_events
        WHERE timestamp BETWEEN $2 AND $3 AND user_id IS NOT NULL
      `, [startOfDay, startOfDay, endOfDay]);
            // Aggregate page views
            await database_1.pgPool.query(`
        INSERT INTO analytics_metrics (metric_name, metric_value, metric_type, tags, timestamp)
        SELECT
          'daily_page_views',
          COUNT(*),
          'counter',
          '{"period": "daily"}',
          $1
        FROM analytics_events
        WHERE timestamp BETWEEN $2 AND $3 AND event_type = 'page_view'
      `, [startOfDay, startOfDay, endOfDay]);
            logging_middleware_1.logger.info('Daily metrics aggregated successfully');
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to aggregate daily metrics', error);
            throw error;
        }
    }
    // Cleanup old data (keep last 90 days of detailed events, older data aggregated)
    async cleanupOldData() {
        try {
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            // Delete old detailed events (keep summary metrics)
            const result = await database_1.pgPool.query(`
        DELETE FROM analytics_events
        WHERE timestamp < $1
      `, [ninetyDaysAgo]);
            logging_middleware_1.logger.info(`Cleaned up ${result.rowCount} old analytics events`);
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to cleanup old data', error);
            throw error;
        }
    }
}
exports.AnalyticsService = AnalyticsService;
exports.analyticsService = new AnalyticsService();
