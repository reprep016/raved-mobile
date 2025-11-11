"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectiveCacheService = void 0;
const cache_service_1 = __importDefault(require("./cache.service"));
const database_1 = require("../config/database");
class SelectiveCacheService {
    /**
     * Register a cache policy for an entity type
     */
    static registerPolicy(policy) {
        this.policies.set(policy.entityType, policy);
    }
    /**
     * Get cached data with selective caching strategy
     */
    static async get(entityType, entityId, fetcher, context) {
        const policy = this.policies.get(entityType);
        if (!policy?.cacheable) {
            // No caching policy, fetch directly
            return fetcher();
        }
        // Determine best strategy based on context
        const strategy = this.selectStrategy(policy, context);
        if (!strategy) {
            return fetcher();
        }
        const cacheKey = this.buildCacheKey(entityType, entityId, strategy.key, context);
        // Try cache first
        const cached = await cache_service_1.default.get(cacheKey, { ttl: strategy.ttl });
        if (cached !== null) {
            // Cache hit
            await this.recordCacheHit(entityType);
            return cached;
        }
        // Cache miss - fetch and cache
        await this.recordCacheMiss(entityType);
        const data = await fetcher();
        // Apply selective caching based on data characteristics
        if (this.shouldCache(data, strategy, context)) {
            await cache_service_1.default.set(cacheKey, data, {
                ttl: strategy.ttl,
                keyPrefix: `selective:${entityType}:`,
            });
            // Set up dependency tracking
            if (strategy.dependencies) {
                await this.trackDependencies(cacheKey, strategy.dependencies, entityId);
            }
        }
        return data;
    }
    /**
     * Invalidate cache for an entity
     */
    static async invalidate(entityType, entityId, cascade = true) {
        const policy = this.policies.get(entityType);
        if (!policy)
            return;
        // Invalidate all strategies for this entity
        for (const strategy of policy.strategies) {
            const cacheKey = this.buildCacheKey(entityType, entityId, strategy.key);
            await cache_service_1.default.delete(cacheKey, { keyPrefix: `selective:${entityType}:` });
        }
        // Cascade invalidation if requested
        if (cascade) {
            await this.invalidateDependencies(entityType, entityId);
        }
    }
    /**
     * Bulk invalidate by entity type
     */
    static async invalidateByType(entityType, entityIds) {
        const pattern = entityIds
            ? entityIds.map(id => `selective:${entityType}:*:${id}:*`).join(' ')
            : `selective:${entityType}:*`;
        await cache_service_1.default.invalidatePattern(pattern);
    }
    /**
     * Warm up cache for frequently accessed entities
     */
    static async warmCache(entityType, entityIds, fetcher) {
        const policy = this.policies.get(entityType);
        if (!policy?.cacheable)
            return;
        const entries = entityIds.map(entityId => ({
            key: this.buildCacheKey(entityType, entityId, 'default'),
            fetcher: () => fetcher(entityId),
            options: {
                keyPrefix: `selective:${entityType}:`,
                ttl: policy.strategies[0]?.ttl || 3600,
            },
        }));
        await cache_service_1.default.warmCache(entries);
    }
    /**
     * Get cache performance metrics
     */
    static async getCacheMetrics() {
        try {
            const [hits, misses] = await Promise.all([
                database_1.redis.get(this.CACHE_HITS_KEY),
                database_1.redis.get(this.CACHE_MISSES_KEY),
            ]);
            const totalHits = parseInt(hits || '0');
            const totalMisses = parseInt(misses || '0');
            const totalRequests = totalHits + totalMisses;
            const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
            // Get metrics by entity type
            const byEntityType = {};
            for (const entityType of this.policies.keys()) {
                const [entityHits, entityMisses] = await Promise.all([
                    database_1.redis.get(`${this.CACHE_HITS_KEY}:${entityType}`),
                    database_1.redis.get(`${this.CACHE_MISSES_KEY}:${entityType}`),
                ]);
                const eHits = parseInt(entityHits || '0');
                const eMisses = parseInt(entityMisses || '0');
                const eTotal = eHits + eMisses;
                const eHitRate = eTotal > 0 ? (eHits / eTotal) * 100 : 0;
                byEntityType[entityType] = {
                    hits: eHits,
                    misses: eMisses,
                    hitRate: eHitRate,
                };
            }
            return {
                hitRate,
                totalRequests,
                hits: totalHits,
                misses: totalMisses,
                byEntityType,
            };
        }
        catch (error) {
            console.error('Error getting cache metrics:', error);
            return {
                hitRate: 0,
                totalRequests: 0,
                hits: 0,
                misses: 0,
                byEntityType: {},
            };
        }
    }
    /**
     * Optimize cache based on access patterns
     */
    static async optimizeCache() {
        const metrics = await this.getCacheMetrics();
        // Identify low-performing caches
        const lowPerformingEntities = Object.entries(metrics.byEntityType)
            .filter(([, stats]) => stats.hitRate < 30 && (stats.hits + stats.misses) > 100)
            .map(([entityType]) => entityType);
        // Adjust TTL for low-performing entities
        for (const entityType of lowPerformingEntities) {
            const policy = this.policies.get(entityType);
            if (policy) {
                // Reduce TTL for low-performing caches
                policy.strategies.forEach(strategy => {
                    strategy.ttl = Math.max(strategy.ttl * 0.7, 60); // Minimum 1 minute
                });
            }
        }
        // Identify high-performing caches
        const highPerformingEntities = Object.entries(metrics.byEntityType)
            .filter(([, stats]) => stats.hitRate > 80 && (stats.hits + stats.misses) > 1000)
            .map(([entityType]) => entityType);
        // Increase TTL for high-performing caches
        for (const entityType of highPerformingEntities) {
            const policy = this.policies.get(entityType);
            if (policy) {
                policy.strategies.forEach(strategy => {
                    strategy.ttl = Math.min(strategy.ttl * 1.5, 86400); // Maximum 24 hours
                });
            }
        }
    }
    /**
     * Select the best caching strategy based on context
     */
    static selectStrategy(policy, context) {
        if (policy.strategies.length === 0)
            return null;
        // Priority-based selection
        if (context?.priority) {
            const priorityStrategy = policy.strategies.find(s => s.priority === context.priority);
            if (priorityStrategy)
                return priorityStrategy;
        }
        // Access pattern-based selection
        if (context?.accessPattern === 'read_heavy') {
            return policy.strategies.find(s => s.priority === 'high') || policy.strategies[0];
        }
        // Default to first strategy
        return policy.strategies[0];
    }
    /**
     * Determine if data should be cached based on various factors
     */
    static shouldCache(data, strategy, context) {
        // Don't cache null, undefined, or empty data
        if (data == null)
            return false;
        // Don't cache errors
        if (data instanceof Error)
            return false;
        // Size-based filtering (don't cache very large objects)
        const dataSize = JSON.stringify(data).length;
        if (dataSize > 1024 * 1024)
            return false; // 1MB limit
        // Context-based filtering
        if (context?.priority === 'low' && strategy.priority === 'high') {
            return false; // Don't cache low priority data in high priority slots
        }
        return true;
    }
    /**
     * Build cache key with context
     */
    static buildCacheKey(entityType, entityId, strategyKey, context) {
        const parts = [entityType, entityId, strategyKey];
        if (context?.userId) {
            parts.push(`user_${context.userId}`);
        }
        return parts.join(':');
    }
    /**
     * Track cache dependencies
     */
    static async trackDependencies(cacheKey, dependencies, entityId) {
        const dependencyKey = `deps:${cacheKey}`;
        try {
            // Store reverse dependencies (what depends on what)
            for (const dep of dependencies) {
                const depKey = `rev_deps:${dep}:${entityId}`;
                await database_1.redis.sadd(depKey, cacheKey);
                await database_1.redis.expire(depKey, 86400); // 24 hours
            }
            // Store forward dependencies
            await database_1.redis.sadd(dependencyKey, dependencies);
            await database_1.redis.expire(dependencyKey, 86400);
        }
        catch (error) {
            console.error('Error tracking dependencies:', error);
        }
    }
    /**
     * Invalidate dependent caches
     */
    static async invalidateDependencies(entityType, entityId) {
        try {
            const revDepKey = `rev_deps:${entityType}:${entityId}`;
            const dependentKeys = await database_1.redis.smembers(revDepKey);
            if (dependentKeys.length > 0) {
                await database_1.redis.del(...dependentKeys.map(key => `selective:${key}`));
                await database_1.redis.del(revDepKey);
            }
        }
        catch (error) {
            console.error('Error invalidating dependencies:', error);
        }
    }
    /**
     * Record cache hit
     */
    static async recordCacheHit(entityType) {
        try {
            await database_1.redis.incr(this.CACHE_HITS_KEY);
            await database_1.redis.incr(`${this.CACHE_HITS_KEY}:${entityType}`);
        }
        catch (error) {
            console.error('Error recording cache hit:', error);
        }
    }
    /**
     * Record cache miss
     */
    static async recordCacheMiss(entityType) {
        try {
            await database_1.redis.incr(this.CACHE_MISSES_KEY);
            await database_1.redis.incr(`${this.CACHE_MISSES_KEY}:${entityType}`);
        }
        catch (error) {
            console.error('Error recording cache miss:', error);
        }
    }
    /**
     * Set up default cache policies for common entities
     */
    static setupDefaultPolicies() {
        // User profile caching
        this.registerPolicy({
            entityType: 'user',
            cacheable: true,
            strategies: [
                {
                    key: 'profile',
                    ttl: 1800, // 30 minutes
                    priority: 'high',
                    invalidationRules: {
                        onEntityChange: ['user'],
                    },
                },
                {
                    key: 'stats',
                    ttl: 300, // 5 minutes
                    priority: 'medium',
                },
            ],
            fallbackStrategy: 'cache_first',
        });
        // Posts caching
        this.registerPolicy({
            entityType: 'post',
            cacheable: true,
            strategies: [
                {
                    key: 'content',
                    ttl: 600, // 10 minutes
                    priority: 'high',
                    invalidationRules: {
                        onEntityChange: ['post', 'comment', 'like'],
                    },
                },
                {
                    key: 'feed',
                    ttl: 300, // 5 minutes
                    priority: 'medium',
                },
            ],
            fallbackStrategy: 'stale_while_revalidate',
        });
        // Events caching
        this.registerPolicy({
            entityType: 'event',
            cacheable: true,
            strategies: [
                {
                    key: 'details',
                    ttl: 3600, // 1 hour
                    priority: 'high',
                    invalidationRules: {
                        onEntityChange: ['event', 'event_attendee'],
                    },
                },
                {
                    key: 'list',
                    ttl: 600, // 10 minutes
                    priority: 'medium',
                },
            ],
            fallbackStrategy: 'cache_first',
        });
        // Store items caching
        this.registerPolicy({
            entityType: 'store_item',
            cacheable: true,
            strategies: [
                {
                    key: 'details',
                    ttl: 1800, // 30 minutes
                    priority: 'high',
                    invalidationRules: {
                        onEntityChange: ['store_item', 'order'],
                    },
                },
                {
                    key: 'search',
                    ttl: 300, // 5 minutes
                    priority: 'medium',
                },
            ],
            fallbackStrategy: 'network_first',
        });
    }
}
exports.SelectiveCacheService = SelectiveCacheService;
SelectiveCacheService.policies = new Map();
SelectiveCacheService.CACHE_HITS_KEY = 'cache_hits';
SelectiveCacheService.CACHE_MISSES_KEY = 'cache_misses';
exports.default = SelectiveCacheService;
