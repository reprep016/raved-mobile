"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.criticalRateLimit = exports.adminRateLimit = exports.interactionRateLimit = exports.commentRateLimit = exports.postRateLimit = exports.searchRateLimit = exports.uploadRateLimit = exports.authRateLimit = exports.generalRateLimit = exports.createRateLimitMiddleware = void 0;
const rate_limiter_service_1 = require("../services/rate-limiter.service");
const rate_limit_analytics_service_1 = require("../services/rate-limit-analytics.service");
const createRateLimitMiddleware = (options = {}) => {
    return async (req, res, next) => {
        try {
            // Determine the key for rate limiting
            const key = options.customKey
                ? options.customKey(req)
                : req.user?.id || req.ip || 'anonymous';
            // Check if request should be skipped
            const shouldSkip = (options.skipForAdmins && req.user?.role === 'admin') ||
                (options.skipForCritical && isCriticalOperation(req)) ||
                req.path === '/health' ||
                req.path.startsWith('/static/');
            // Check rate limit
            const result = await rate_limiter_service_1.rateLimiterService.checkRateLimit(key, req.user?.id, options.endpoint, { skip: shouldSkip });
            // Set rate limit headers
            setRateLimitHeaders(res, result);
            if (!result.allowed) {
                // Record blocked request analytics
                rate_limit_analytics_service_1.rateLimitAnalyticsService.recordEvent({
                    userId: req.user?.id,
                    ip: req.ip || req.connection.remoteAddress || 'unknown',
                    endpoint: options.endpoint || req.path,
                    method: req.method,
                    tier: req.user?.subscription_tier || 'free',
                    requestsCount: 1,
                    blocked: true,
                });
                // Rate limit exceeded
                res.status(429).json({
                    success: false,
                    error: 'Too many requests',
                    message: 'Rate limit exceeded. Please try again later.',
                    retryAfter: result.retryAfter,
                });
                return;
            }
            // Record analytics
            rate_limit_analytics_service_1.rateLimitAnalyticsService.recordEvent({
                userId: req.user?.id,
                ip: req.ip || req.connection.remoteAddress || 'unknown',
                endpoint: options.endpoint || req.path,
                method: req.method,
                tier: req.user?.subscription_tier || 'free',
                requestsCount: 1,
                blocked: false,
            });
            // Add rate limit info to request for analytics
            req.rateLimitInfo = {
                key,
                userId: req.user?.id,
                endpoint: options.endpoint || req.path,
                method: req.method,
                allowed: result.allowed,
                remaining: result.remaining,
                resetTime: result.resetTime,
            };
            next();
        }
        catch (error) {
            console.error('Rate limit middleware error:', error);
            // Allow request on error to avoid blocking legitimate traffic
            next();
        }
    };
};
exports.createRateLimitMiddleware = createRateLimitMiddleware;
/**
 * Check if the operation is critical and should bypass rate limiting
 */
function isCriticalOperation(req) {
    const criticalPaths = [
        '/api/v1/auth/login',
        '/api/v1/auth/refresh',
        '/api/v1/health',
        '/api/v1/admin/emergency',
    ];
    return criticalPaths.some(path => req.path.includes(path));
}
/**
 * Set rate limit headers on the response
 */
function setRateLimitHeaders(res, result) {
    const headers = {
        'X-RateLimit-Limit': '100', // Default, will be overridden by specific limits
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.floor(result.resetTime.getTime() / 1000).toString(),
    };
    if (!result.allowed && result.retryAfter) {
        headers['X-RateLimit-Retry-After'] = result.retryAfter.toString();
    }
    res.set(headers);
}
// Pre-configured middleware for different use cases
exports.generalRateLimit = (0, exports.createRateLimitMiddleware)();
exports.authRateLimit = (0, exports.createRateLimitMiddleware)({
    endpoint: 'auth',
    skipForCritical: true,
});
exports.uploadRateLimit = (0, exports.createRateLimitMiddleware)({
    endpoint: 'upload',
    customKey: (req) => req.user?.id || req.ip || 'anonymous',
});
exports.searchRateLimit = (0, exports.createRateLimitMiddleware)({
    endpoint: 'search',
});
exports.postRateLimit = (0, exports.createRateLimitMiddleware)({
    endpoint: 'posts',
    customKey: (req) => req.user?.id || req.ip || 'anonymous',
});
exports.commentRateLimit = (0, exports.createRateLimitMiddleware)({
    endpoint: 'comments',
    customKey: (req) => req.user?.id || req.ip || 'anonymous',
});
exports.interactionRateLimit = (0, exports.createRateLimitMiddleware)({
    endpoint: 'interactions',
    customKey: (req) => req.user?.id || req.ip || 'anonymous',
});
// Admin rate limit (more permissive)
exports.adminRateLimit = (0, exports.createRateLimitMiddleware)({
    skipForAdmins: true,
});
// Critical operations bypass
exports.criticalRateLimit = (0, exports.createRateLimitMiddleware)({
    skipForCritical: true,
});
