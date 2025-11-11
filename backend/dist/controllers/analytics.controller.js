"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsController = exports.AnalyticsController = void 0;
const analytics_service_1 = require("../services/analytics.service");
const logging_middleware_1 = require("../middleware/logging.middleware");
const database_1 = require("../config/database");
class AnalyticsController {
    // Get real-time analytics metrics
    async getRealtimeMetrics(req, res) {
        try {
            const timeRange = parseInt(req.query.timeRange) || 60; // Default 60 minutes
            const metrics = await analytics_service_1.analyticsService.getRealtimeMetrics(timeRange);
            res.json({
                success: true,
                data: metrics
            });
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to get realtime metrics', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch realtime metrics'
            });
        }
    }
    // Get analytics dashboard overview
    async getDashboardOverview(req, res) {
        try {
            const period = req.query.period || '7d'; // 1d, 7d, 30d, 90d
            const endDate = new Date();
            const startDate = new Date();
            switch (period) {
                case '1d':
                    startDate.setDate(endDate.getDate() - 1);
                    break;
                case '7d':
                    startDate.setDate(endDate.getDate() - 7);
                    break;
                case '30d':
                    startDate.setDate(endDate.getDate() - 30);
                    break;
                case '90d':
                    startDate.setDate(endDate.getDate() - 90);
                    break;
                default:
                    startDate.setDate(endDate.getDate() - 7);
            }
            const [realtimeMetrics, userActivity, topPages, deviceBreakdown] = await Promise.all([
                analytics_service_1.analyticsService.getRealtimeMetrics(1440), // Last 24 hours
                this.getUserActivityStats(startDate, endDate),
                this.getTopPages(startDate, endDate),
                this.getDeviceBreakdown(startDate, endDate)
            ]);
            res.json({
                success: true,
                data: {
                    period,
                    realtime: realtimeMetrics,
                    userActivity,
                    topPages,
                    deviceBreakdown,
                    generatedAt: new Date().toISOString()
                }
            });
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to get dashboard overview', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dashboard overview'
            });
        }
    }
    // Get user activity statistics
    async getUserActivityStats(startDate, endDate) {
        const result = await database_1.pgPool.query(`
      SELECT
        DATE(timestamp) as date,
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_events
      FROM analytics_events
      WHERE timestamp BETWEEN $1 AND $2 AND user_id IS NOT NULL
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
      LIMIT 30
    `, [startDate, endDate]);
        return result.rows;
    }
    // Get top pages
    async getTopPages(startDate, endDate) {
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
      LIMIT 10
    `, [startDate, endDate]);
        return result.rows;
    }
    // Get device breakdown
    async getDeviceBreakdown(startDate, endDate) {
        const result = await database_1.pgPool.query(`
      SELECT
        device_type,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
      FROM analytics_events
      WHERE timestamp BETWEEN $1 AND $2
      GROUP BY device_type
      ORDER BY count DESC
    `, [startDate, endDate]);
        return result.rows;
    }
    // Get user activity history
    async getUserActivityHistory(req, res) {
        try {
            const { userId } = req.params;
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;
            const activities = await analytics_service_1.analyticsService.getUserActivityHistory(userId, limit, offset);
            res.json({
                success: true,
                data: activities,
                pagination: {
                    limit,
                    offset,
                    hasMore: activities.length === limit
                }
            });
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to get user activity history', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user activity history'
            });
        }
    }
    // Generate analytics report
    async generateReport(req, res) {
        try {
            const { reportType, startDate, endDate } = req.body;
            if (!['daily', 'weekly', 'monthly'].includes(reportType)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid report type. Must be daily, weekly, or monthly.'
                });
            }
            const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const end = endDate ? new Date(endDate) : new Date();
            const report = await analytics_service_1.analyticsService.generateReport(reportType, start, end);
            res.json({
                success: true,
                data: report
            });
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to generate report', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate analytics report'
            });
        }
    }
    // Get analytics reports list
    async getReports(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 20;
            const offset = parseInt(req.query.offset) || 0;
            const reportType = req.query.type;
            let query = `
        SELECT * FROM analytics_reports
        WHERE 1=1
      `;
            const params = [];
            let paramIndex = 1;
            if (reportType) {
                query += ` AND report_type = $${paramIndex}`;
                params.push(reportType);
                paramIndex++;
            }
            query += ` ORDER BY generated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            params.push(limit, offset);
            const result = await database_1.pgPool.query(query, params);
            const reports = result.rows.map((row) => ({
                ...row,
                data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
            }));
            res.json({
                success: true,
                data: reports,
                pagination: {
                    limit,
                    offset,
                    hasMore: reports.length === limit
                }
            });
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to get reports', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch analytics reports'
            });
        }
    }
    // A/B Testing endpoints
    // Create A/B test
    async createABTest(req, res) {
        try {
            const testData = req.body;
            // Validate required fields
            if (!testData.test_name || !testData.feature_name || !testData.variants) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: test_name, feature_name, variants'
                });
            }
            // Validate variants is an array
            if (!Array.isArray(testData.variants) || testData.variants.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Variants must be an array with at least 2 options'
                });
            }
            const test = await analytics_service_1.analyticsService.createABTest({
                test_name: testData.test_name,
                test_description: testData.test_description,
                feature_name: testData.feature_name,
                variants: testData.variants,
                weights: testData.weights,
                start_date: new Date(testData.start_date || Date.now()),
                end_date: testData.end_date ? new Date(testData.end_date) : undefined,
                status: testData.status || 'active'
            });
            res.status(201).json({
                success: true,
                data: test
            });
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to create A/B test', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create A/B test'
            });
        }
    }
    // Get A/B test variant for user
    async getABTestVariant(req, res) {
        try {
            const { testName } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User authentication required'
                });
            }
            const variant = await analytics_service_1.analyticsService.getVariantForUser(testName, userId);
            res.json({
                success: true,
                data: {
                    testName,
                    variant,
                    userId
                }
            });
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to get A/B test variant', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get A/B test variant'
            });
        }
    }
    // Track A/B test result
    async trackABTestResult(req, res) {
        try {
            const { testName } = req.params;
            const { eventType, eventValue } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User authentication required'
                });
            }
            await analytics_service_1.analyticsService.trackABTestResult(testName, userId, eventType, eventValue);
            res.json({
                success: true,
                message: 'A/B test result tracked successfully'
            });
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to track A/B test result', error);
            res.status(500).json({
                success: false,
                message: 'Failed to track A/B test result'
            });
        }
    }
    // Get A/B test results
    async getABTestResults(req, res) {
        try {
            const { testName } = req.params;
            const result = await database_1.pgPool.query(`
        SELECT
          variant_name,
          COUNT(DISTINCT user_id) as participants,
          COUNT(CASE WHEN event_type != 'variant_assigned' THEN 1 END) as conversions,
          AVG(CASE WHEN event_type != 'variant_assigned' THEN event_value END) as avg_conversion_value
        FROM ab_test_results
        WHERE test_id = (SELECT id FROM ab_tests WHERE test_name = $1)
        GROUP BY variant_name
      `, [testName]);
            res.json({
                success: true,
                data: {
                    testName,
                    results: result.rows
                }
            });
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to get A/B test results', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch A/B test results'
            });
        }
    }
    // Custom analytics queries
    async runCustomQuery(req, res) {
        try {
            const { query, params, type } = req.body;
            // Basic security check - only allow SELECT queries
            if (!query.toLowerCase().trim().startsWith('select')) {
                return res.status(400).json({
                    success: false,
                    message: 'Only SELECT queries are allowed'
                });
            }
            // Limit query execution time and results
            const limitedQuery = `${query} LIMIT 1000`;
            const result = await database_1.pgPool.query(limitedQuery, params || []);
            res.json({
                success: true,
                data: {
                    rows: result.rows,
                    rowCount: result.rowCount,
                    fields: result.fields?.map((f) => f.name)
                }
            });
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to run custom query', error);
            res.status(500).json({
                success: false,
                message: 'Failed to execute custom query'
            });
        }
    }
    // Export analytics data
    async exportAnalyticsData(req, res) {
        try {
            const { startDate, endDate, format } = req.query;
            const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const end = endDate ? new Date(endDate) : new Date();
            const result = await database_1.pgPool.query(`
        SELECT
          timestamp,
          event_type,
          event_category,
          event_action,
          user_id,
          session_id,
          page_url,
          device_type,
          browser,
          os
        FROM analytics_events
        WHERE timestamp BETWEEN $1 AND $2
        ORDER BY timestamp DESC
        LIMIT 50000
      `, [start, end]);
            if (format === 'csv') {
                // Convert to CSV format
                const csvData = this.convertToCSV(result.rows);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename="analytics_export.csv"');
                res.send(csvData);
            }
            else {
                // JSON format
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename="analytics_export.json"');
                res.json({
                    success: true,
                    data: result.rows,
                    metadata: {
                        startDate: start.toISOString(),
                        endDate: end.toISOString(),
                        totalRecords: result.rowCount
                    }
                });
            }
        }
        catch (error) {
            logging_middleware_1.logger.error('Failed to export analytics data', error);
            res.status(500).json({
                success: false,
                message: 'Failed to export analytics data'
            });
        }
    }
    convertToCSV(data) {
        if (data.length === 0)
            return '';
        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const value = row[header];
                // Escape commas and quotes in CSV
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value || '';
            }).join(','))
        ];
        return csvRows.join('\n');
    }
}
exports.AnalyticsController = AnalyticsController;
exports.analyticsController = new AnalyticsController();
