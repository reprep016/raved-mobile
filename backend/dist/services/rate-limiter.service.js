"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiterService = exports.RateLimiterService = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("../config");
const rate_limit_1 = require("../types/rate-limit");
class RateLimiterService {
    constructor() {
        this.limiters = new Map();
        this.tierOverrides = new Map();
        this.endpointLimits = new Map();
        this.redis = new ioredis_1.default(config_1.CONFIG.REDIS_URL);
        this.initializeLimiters();
        this.loadEndpointLimits();
    }
    initializeLimiters() {
        // Initialize limiters for each tier
        Object.values(rate_limit_1.DEFAULT_RATE_LIMIT_TIERS).forEach(tier => {
            const limiter = new rate_limiter_flexible_1.RateLimiterRedis({
                storeClient: this.redis,
                keyPrefix: `rate_limit:${tier.name}`,
                points: tier.maxRequests,
                duration: Math.floor(tier.windowMs / 1000), // Convert to seconds
                blockDuration: tier.blockDuration ? Math.floor(tier.blockDuration / 1000) : undefined,
            });
            this.limiters.set(tier.name, limiter);
        });
    }
    loadEndpointLimits() {
        // Load default endpoint limits
        Object.entries(rate_limit_1.DEFAULT_ENDPOINT_LIMITS).forEach(([endpoint, config]) => {
            this.endpointLimits.set(endpoint, config);
        });
    }
    /**
     * Get rate limiter for a specific tier
     */
    getLimiter(tier) {
        const limiter = this.limiters.get(tier);
        if (!limiter) {
            throw new Error(`Rate limiter for tier '${tier}' not found`);
        }
        return limiter;
    }
    /**
     * Get user's effective tier considering overrides
     */
    getEffectiveTier(userId, defaultTier = 'free') {
        if (!userId)
            return defaultTier;
        const override = this.tierOverrides.get(userId);
        if (override && (!override.expiresAt || override.expiresAt > new Date())) {
            return override.tier;
        }
        return defaultTier;
    }
    /**
     * Get rate limit configuration for a user and endpoint
     */
    getRateLimitConfig(userId, endpoint) {
        const tier = this.getEffectiveTier(userId);
        const endpointConfig = endpoint ? this.endpointLimits.get(endpoint) : null;
        if (endpointConfig) {
            return endpointConfig;
        }
        const tierConfig = rate_limit_1.DEFAULT_RATE_LIMIT_TIERS[tier];
        return {
            tier,
            windowMs: tierConfig.windowMs,
            maxRequests: tierConfig.maxRequests,
            blockDuration: tierConfig.blockDuration,
        };
    }
    /**
     * Check if request should be rate limited
     */
    async checkRateLimit(key, userId, endpoint, options = {}) {
        if (options.skip) {
            return {
                allowed: true,
                remaining: 999,
                resetTime: new Date(Date.now() + 900000), // 15 minutes
            };
        }
        const config = this.getRateLimitConfig(userId, endpoint);
        const limiter = this.getLimiter(config.tier);
        try {
            const res = await limiter.get(key);
            if (res && res.remainingPoints <= 0) {
                // Rate limit exceeded
                const resetTime = new Date(Date.now() + (res.msBeforeNext || 0));
                const retryAfter = Math.ceil((res.msBeforeNext || 0) / 1000);
                return {
                    allowed: false,
                    remaining: 0,
                    resetTime,
                    retryAfter,
                };
            }
            // Consume a point
            const resConsume = await limiter.consume(key);
            return {
                allowed: true,
                remaining: resConsume.remainingPoints,
                resetTime: new Date(Date.now() + (resConsume.msBeforeNext || 0)),
            };
        }
        catch (error) {
            console.error('Rate limiter error:', error);
            // Allow request on error to avoid blocking legitimate traffic
            return {
                allowed: true,
                remaining: 999,
                resetTime: new Date(Date.now() + 900000),
            };
        }
    }
    /**
     * Set tier override for a user
     */
    setTierOverride(override) {
        this.tierOverrides.set(override.userId, override);
    }
    /**
     * Remove tier override for a user
     */
    removeTierOverride(userId) {
        this.tierOverrides.delete(userId);
    }
    /**
     * Update endpoint rate limit configuration
     */
    updateEndpointLimit(endpoint, config) {
        this.endpointLimits.set(endpoint, config);
    }
    /**
     * Get current rate limit status for a key
     */
    async getRateLimitStatus(key, tier) {
        try {
            const limiter = this.getLimiter(tier);
            const res = await limiter.get(key);
            if (!res)
                return null;
            return {
                remaining: res.remainingPoints,
                resetTime: new Date(Date.now() + (res.msBeforeNext || 0)),
            };
        }
        catch (error) {
            console.error('Error getting rate limit status:', error);
            return null;
        }
    }
    /**
     * Reset rate limit for a key
     */
    async resetRateLimit(key, tier) {
        try {
            const limiter = this.getLimiter(tier);
            await limiter.delete(key);
        }
        catch (error) {
            console.error('Error resetting rate limit:', error);
        }
    }
    /**
     * Get all active tier overrides
     */
    getActiveOverrides() {
        const now = new Date();
        return Array.from(this.tierOverrides.values()).filter(override => !override.expiresAt || override.expiresAt > now);
    }
    /**
     * Clean up expired overrides
     */
    cleanupExpiredOverrides() {
        const now = new Date();
        for (const [userId, override] of this.tierOverrides) {
            if (override.expiresAt && override.expiresAt <= now) {
                this.tierOverrides.delete(userId);
            }
        }
    }
    /**
     * Close Redis connection
     */
    async close() {
        await this.redis.quit();
    }
}
exports.RateLimiterService = RateLimiterService;
// Singleton instance
exports.rateLimiterService = new RateLimiterService();
