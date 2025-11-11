"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitAnalyticsService = exports.RateLimitAnalyticsService = void 0;
const rate_limiter_service_1 = require("./rate-limiter.service");
class RateLimitAnalyticsService {
    constructor() {
        this.analytics = [];
        this.maxAnalyticsSize = 10000; // Keep last 10k records in memory
    }
    /**
     * Record a rate limit event
     */
    recordEvent(event) {
        const analyticsEvent = {
            id: this.generateId(),
            ...event,
            timestamp: new Date(),
        };
        this.analytics.push(analyticsEvent);
        // Maintain size limit
        if (this.analytics.length > this.maxAnalyticsSize) {
            this.analytics = this.analytics.slice(-this.maxAnalyticsSize);
        }
    }
    /**
     * Get rate limit statistics
     */
    getStatistics(timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        end: new Date()
    }) {
        const filteredEvents = this.analytics.filter(event => event.timestamp >= timeRange.start && event.timestamp <= timeRange.end);
        const totalRequests = filteredEvents.length;
        const blockedRequests = filteredEvents.filter(e => e.blocked).length;
        const blockRate = totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0;
        // Group by tier
        const tierStats = filteredEvents.reduce((acc, event) => {
            if (!acc[event.tier]) {
                acc[event.tier] = { total: 0, blocked: 0 };
            }
            acc[event.tier].total++;
            if (event.blocked) {
                acc[event.tier].blocked++;
            }
            return acc;
        }, {});
        // Group by endpoint
        const endpointStats = filteredEvents.reduce((acc, event) => {
            if (!acc[event.endpoint]) {
                acc[event.endpoint] = { total: 0, blocked: 0 };
            }
            acc[event.endpoint].total++;
            if (event.blocked) {
                acc[event.endpoint].blocked++;
            }
            return acc;
        }, {});
        // Group by user (top 10 most active)
        const userStats = filteredEvents.reduce((acc, event) => {
            if (!event.userId)
                return acc;
            if (!acc[event.userId]) {
                acc[event.userId] = { total: 0, blocked: 0 };
            }
            acc[event.userId].total++;
            if (event.blocked) {
                acc[event.userId].blocked++;
            }
            return acc;
        }, {});
        const topUsers = Object.entries(userStats)
            .sort(([, a], [, b]) => b.total - a.total)
            .slice(0, 10);
        return {
            timeRange,
            totalRequests,
            blockedRequests,
            blockRate: Math.round(blockRate * 100) / 100,
            tierStats,
            endpointStats,
            topUsers,
        };
    }
    /**
     * Get rate limit status for a specific user
     */
    async getUserRateLimitStatus(userId) {
        const tiers = ['free', 'premium', 'admin'];
        const statusPromises = tiers.map(async (tier) => {
            const key = `user:${userId}`;
            const status = await rate_limiter_service_1.rateLimiterService.getRateLimitStatus(key, tier);
            return {
                tier,
                status,
            };
        });
        const results = await Promise.all(statusPromises);
        return {
            userId,
            tiers: results,
        };
    }
    /**
     * Get recent blocked requests
     */
    getRecentBlockedRequests(limit = 50) {
        return this.analytics
            .filter(event => event.blocked)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }
    /**
     * Get rate limit violations by IP
     */
    getViolationsByIP(timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
    }) {
        const filteredEvents = this.analytics.filter(event => event.timestamp >= timeRange.start &&
            event.timestamp <= timeRange.end &&
            event.blocked);
        const violationsByIP = filteredEvents.reduce((acc, event) => {
            if (!acc[event.ip]) {
                acc[event.ip] = 0;
            }
            acc[event.ip]++;
            return acc;
        }, {});
        return Object.entries(violationsByIP)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20); // Top 20 violating IPs
    }
    /**
     * Clear old analytics data
     */
    clearOldData(olderThan) {
        this.analytics = this.analytics.filter(event => event.timestamp > olderThan);
    }
    /**
     * Export analytics data
     */
    exportData() {
        return [...this.analytics];
    }
    /**
     * Reset analytics
     */
    reset() {
        this.analytics = [];
    }
    generateId() {
        return `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.RateLimitAnalyticsService = RateLimitAnalyticsService;
// Singleton instance
exports.rateLimitAnalyticsService = new RateLimitAnalyticsService();
