"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheStrategies = void 0;
exports.cache = cache;
exports.clearCache = clearCache;
exports.clearCacheOnChange = clearCacheOnChange;
const database_1 = require("../config/database");
const config_1 = require("../config");
function cache(options = {}) {
    return async (req, res, next) => {
        // Skip caching if condition is not met
        if (options.condition && !options.condition(req)) {
            return next();
        }
        // Generate cache key
        const cacheKey = options.key || generateCacheKey(req);
        const fullKey = `${config_1.CONFIG.REDIS_CACHE_PREFIX}${cacheKey}`;
        try {
            // Try to get cached response
            const cachedData = await database_1.redis.get(fullKey);
            if (cachedData) {
                const parsedData = JSON.parse(cachedData);
                return res.json(parsedData);
            }
            // Store original json method
            const originalJson = res.json;
            // Override json method to cache response
            res.json = function (data) {
                // Cache the response
                const ttl = options.ttl || config_1.CONFIG.CACHE_TTL;
                database_1.redis.setex(fullKey, ttl, JSON.stringify(data));
                // Call original json method
                return originalJson.call(this, data);
            };
            next();
        }
        catch (error) {
            // If caching fails, continue without caching
            console.warn('Cache middleware error:', error);
            next();
        }
    };
}
async function clearCache(pattern) {
    try {
        const keys = await database_1.redis.keys(`${config_1.CONFIG.REDIS_CACHE_PREFIX}${pattern}`);
        if (keys.length > 0) {
            await database_1.redis.del(keys);
        }
    }
    catch (error) {
        console.warn('Cache clear error:', error);
    }
}
function clearCacheOnChange(pattern) {
    return (req, res, next) => {
        const originalJson = res.json;
        res.json = function (data) {
            // Clear cache after successful response
            if (res.statusCode >= 200 && res.statusCode < 300) {
                clearCache(pattern);
            }
            return originalJson.call(this, data);
        };
        next();
    };
}
function generateCacheKey(req) {
    // Generate a unique key based on request
    const parts = [
        req.method,
        req.originalUrl,
        req.user?.id || 'anonymous'
    ];
    // Add query parameters if they exist
    if (Object.keys(req.query).length > 0) {
        parts.push(JSON.stringify(req.query));
    }
    return parts.join(':');
}
// Specific cache strategies for different endpoints
exports.cacheStrategies = {
    // Cache user profile data for 30 minutes
    userProfile: cache({ ttl: 30 * 60 }),
    // Cache public posts for 5 minutes
    publicPosts: cache({ ttl: 5 * 60 }),
    // Cache store items for 10 minutes
    storeItems: cache({ ttl: 10 * 60 }),
    // Cache events for 15 minutes
    events: cache({ ttl: 15 * 60 }),
    // Cache search results for 2 minutes
    searchResults: cache({ ttl: 2 * 60 }),
    // Only cache for GET requests
    getOnly: cache({
        condition: (req) => req.method === 'GET'
    }),
    // Cache for authenticated users only
    authenticatedOnly: cache({
        condition: (req) => !!req.user
    })
};
