"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ENDPOINT_LIMITS = exports.DEFAULT_RATE_LIMIT_TIERS = void 0;
// Default rate limit tiers
exports.DEFAULT_RATE_LIMIT_TIERS = {
    free: {
        name: 'free',
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        blockDuration: 15 * 60 * 1000, // 15 minutes
    },
    premium: {
        name: 'premium',
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 500,
        blockDuration: 5 * 60 * 1000, // 5 minutes
    },
    admin: {
        name: 'admin',
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 2000,
        blockDuration: 60 * 1000, // 1 minute
    },
};
// Default endpoint-specific limits
exports.DEFAULT_ENDPOINT_LIMITS = {
    auth: {
        tier: 'free',
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5,
        blockDuration: 15 * 60 * 1000,
    },
    upload: {
        tier: 'free',
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 20,
        blockDuration: 60 * 60 * 1000,
    },
    search: {
        tier: 'free',
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 30,
        blockDuration: 60 * 1000,
    },
    posts: {
        tier: 'free',
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 10,
        blockDuration: 60 * 60 * 1000,
    },
    comments: {
        tier: 'free',
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 50,
        blockDuration: 60 * 60 * 1000,
    },
    interactions: {
        tier: 'free',
        windowMs: 60 * 60 * 1000, // 1 hour
        maxRequests: 100,
        blockDuration: 60 * 60 * 1000,
    },
};
