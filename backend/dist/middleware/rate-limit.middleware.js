"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimitMiddleware = exports.criticalRateLimit = exports.adminRateLimit = exports.interactionRateLimit = exports.commentRateLimit = exports.postRateLimit = exports.searchRateLimit = exports.uploadRateLimit = exports.authRateLimit = exports.generalRateLimit = exports.interactionLimiter = exports.commentLimiter = exports.postLimiter = exports.searchLimiter = exports.uploadLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = require("../config");
// Legacy rate limiters (keeping for backward compatibility)
// These will be gradually replaced with the new Redis-based system
// General API rate limiter
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.CONFIG.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
    max: config_1.CONFIG.RATE_LIMIT_MAX_REQUESTS || 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil((config_1.CONFIG.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000) / 1000)
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => {
        // Skip rate limiting for health checks and static files
        return req.path === '/health' || req.path.startsWith('/static/');
    }
});
// Stricter limiter for authentication endpoints
exports.authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 auth attempts per windowMs
    message: {
        success: false,
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: 900 // 15 minutes in seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful requests
    skipFailedRequests: false // Count failed requests (brute force protection)
});
// Limiter for file uploads
exports.uploadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // limit each IP to 20 uploads per hour
    message: {
        success: false,
        error: 'Upload limit exceeded, please try again later.',
        retryAfter: 3600 // 1 hour in seconds
    },
    standardHeaders: true,
    legacyHeaders: false
});
// Limiter for search endpoints
exports.searchLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // limit each IP to 30 searches per minute
    message: {
        success: false,
        error: 'Too many search requests, please slow down.',
        retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false
});
// Limiter for post creation
exports.postLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each user to 10 posts per hour
    message: {
        success: false,
        error: 'Post creation limit exceeded, please try again later.',
        retryAfter: 3600
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use user ID for authenticated requests, IP for anonymous
        return req.user?.id || req.ip;
    }
});
// Limiter for comments
exports.commentLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // limit each user to 50 comments per hour
    message: {
        success: false,
        error: 'Comment limit exceeded, please try again later.',
        retryAfter: 3600
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.id || req.ip;
    }
});
// Limiter for likes/follows
exports.interactionLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // limit each user to 100 interactions per hour
    message: {
        success: false,
        error: 'Interaction limit exceeded, please try again later.',
        retryAfter: 3600
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.id || req.ip;
    }
});
// Re-export new Redis-based middleware for gradual migration
var rate_limit_v2_middleware_1 = require("./rate-limit-v2.middleware");
Object.defineProperty(exports, "generalRateLimit", { enumerable: true, get: function () { return rate_limit_v2_middleware_1.generalRateLimit; } });
Object.defineProperty(exports, "authRateLimit", { enumerable: true, get: function () { return rate_limit_v2_middleware_1.authRateLimit; } });
Object.defineProperty(exports, "uploadRateLimit", { enumerable: true, get: function () { return rate_limit_v2_middleware_1.uploadRateLimit; } });
Object.defineProperty(exports, "searchRateLimit", { enumerable: true, get: function () { return rate_limit_v2_middleware_1.searchRateLimit; } });
Object.defineProperty(exports, "postRateLimit", { enumerable: true, get: function () { return rate_limit_v2_middleware_1.postRateLimit; } });
Object.defineProperty(exports, "commentRateLimit", { enumerable: true, get: function () { return rate_limit_v2_middleware_1.commentRateLimit; } });
Object.defineProperty(exports, "interactionRateLimit", { enumerable: true, get: function () { return rate_limit_v2_middleware_1.interactionRateLimit; } });
Object.defineProperty(exports, "adminRateLimit", { enumerable: true, get: function () { return rate_limit_v2_middleware_1.adminRateLimit; } });
Object.defineProperty(exports, "criticalRateLimit", { enumerable: true, get: function () { return rate_limit_v2_middleware_1.criticalRateLimit; } });
Object.defineProperty(exports, "createRateLimitMiddleware", { enumerable: true, get: function () { return rate_limit_v2_middleware_1.createRateLimitMiddleware; } });
