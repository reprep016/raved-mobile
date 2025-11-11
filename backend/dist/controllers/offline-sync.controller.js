"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheMetrics = exports.clearUserCache = exports.getOfflineAnalytics = exports.getDataVersionHistory = exports.getOfflineDataStats = exports.syncOfflineData = exports.storeOfflineData = exports.getDeviceStatuses = exports.updateDeviceStatus = exports.autoResolveConflicts = exports.getSyncConflicts = exports.resolveSyncConflict = exports.getOfflineQueueStatus = exports.processOfflineQueue = exports.queueOfflineRequest = void 0;
const express_validator_1 = require("express-validator");
const offline_queue_service_1 = __importDefault(require("../services/offline-queue.service"));
const sync_conflict_service_1 = __importDefault(require("../services/sync-conflict.service"));
const offline_status_service_1 = __importDefault(require("../services/offline-status.service"));
const offline_data_service_1 = __importDefault(require("../services/offline-data.service"));
const data_versioning_service_1 = __importDefault(require("../services/data-versioning.service"));
const offline_analytics_service_1 = __importDefault(require("../services/offline-analytics.service"));
const selective_cache_service_1 = __importDefault(require("../services/selective-cache.service"));
/**
 * Add a request to the offline queue
 */
const queueOfflineRequest = async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const userId = req.user.id;
        const { method, url, headers = {}, body, priority = 0, maxRetries = 3, scheduledAt, dependencies = [], tags = [] } = req.body;
        const queueItem = await offline_queue_service_1.default.addToQueue(userId, {
            method,
            url,
            headers,
            body,
            priority,
            maxRetries,
            scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
            dependencies,
            tags,
        });
        // Track analytics
        await offline_analytics_service_1.default.queueAnalyticsEvent({
            userId,
            sessionId: req.headers['x-session-id'] || `queue_${Date.now()}`,
            eventType: 'offline_request_queued',
            eventCategory: 'offline_sync',
            eventAction: method,
            timestamp: new Date(),
            offline: true,
            metadata: {
                url,
                priority,
                hasDependencies: dependencies.length > 0,
            },
        });
        res.json({
            success: true,
            message: 'Request queued for offline processing',
            queueItem: {
                id: queueItem.id,
                requestId: queueItem.requestId,
                method: queueItem.method,
                url: queueItem.url,
                priority: queueItem.priority,
                status: queueItem.status,
                createdAt: queueItem.createdAt,
            },
        });
    }
    catch (error) {
        console.error('Queue offline request error:', error);
        res.status(500).json({ error: error.message || 'Failed to queue request' });
    }
};
exports.queueOfflineRequest = queueOfflineRequest;
/**
 * Process queued offline requests
 */
const processOfflineQueue = async (req, res) => {
    try {
        const userId = req.user.id;
        const { maxItems } = req.body;
        // Process queue items
        await offline_queue_service_1.default.processQueue(userId);
        // Get updated queue stats
        const stats = await offline_queue_service_1.default.getQueueStats(userId);
        res.json({
            success: true,
            message: 'Queue processing completed',
            stats,
        });
    }
    catch (error) {
        console.error('Process offline queue error:', error);
        res.status(500).json({ error: error.message || 'Failed to process queue' });
    }
};
exports.processOfflineQueue = processOfflineQueue;
/**
 * Get offline queue status
 */
const getOfflineQueueStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const stats = await offline_queue_service_1.default.getQueueStats(userId);
        res.json({
            success: true,
            stats,
        });
    }
    catch (error) {
        console.error('Get queue status error:', error);
        res.status(500).json({ error: error.message || 'Failed to get queue status' });
    }
};
exports.getOfflineQueueStatus = getOfflineQueueStatus;
/**
 * Resolve sync conflicts
 */
const resolveSyncConflict = async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const { conflictId } = req.params;
        const { strategy, resolvedData } = req.body;
        const userId = req.user.id;
        const resolution = {
            strategy,
            resolvedData,
            resolvedBy: userId,
        };
        const conflict = await sync_conflict_service_1.default.resolveConflict(conflictId, resolution);
        // Track analytics
        await offline_analytics_service_1.default.queueAnalyticsEvent({
            userId,
            sessionId: req.headers['x-session-id'] || `conflict_${Date.now()}`,
            eventType: 'conflict_resolved',
            eventCategory: 'sync',
            eventAction: strategy,
            timestamp: new Date(),
            offline: false,
            metadata: {
                conflictId,
                entityType: conflict.entityType,
                entityId: conflict.entityId,
            },
        });
        res.json({
            success: true,
            message: 'Conflict resolved successfully',
            conflict: {
                id: conflict.id,
                entityType: conflict.entityType,
                entityId: conflict.entityId,
                resolutionStrategy: conflict.resolutionStrategy,
                resolved: conflict.resolved,
                resolvedAt: conflict.resolvedAt,
            },
        });
    }
    catch (error) {
        console.error('Resolve conflict error:', error);
        res.status(500).json({ error: error.message || 'Failed to resolve conflict' });
    }
};
exports.resolveSyncConflict = resolveSyncConflict;
/**
 * Get unresolved sync conflicts
 */
const getSyncConflicts = async (req, res) => {
    try {
        const userId = req.user.id;
        const { entityType, limit = 50, offset = 0 } = req.query;
        const conflicts = await sync_conflict_service_1.default.getUnresolvedConflicts(userId, entityType, parseInt(limit), parseInt(offset));
        res.json({
            success: true,
            conflicts: conflicts.map(conflict => ({
                id: conflict.id,
                entityType: conflict.entityType,
                entityId: conflict.entityId,
                conflictType: conflict.conflictType,
                localVersion: conflict.localVersion,
                serverVersion: conflict.serverVersion,
                localData: conflict.localData,
                serverData: conflict.serverData,
                createdAt: conflict.createdAt,
            })),
        });
    }
    catch (error) {
        console.error('Get sync conflicts error:', error);
        res.status(500).json({ error: error.message || 'Failed to get conflicts' });
    }
};
exports.getSyncConflicts = getSyncConflicts;
/**
 * Auto-resolve conflicts
 */
const autoResolveConflicts = async (req, res) => {
    try {
        const userId = req.user.id;
        const { entityType, rules } = req.body;
        const resolvedCount = await sync_conflict_service_1.default.autoResolveConflicts(userId, entityType, rules);
        res.json({
            success: true,
            message: `Auto-resolved ${resolvedCount} conflicts`,
            resolvedCount,
        });
    }
    catch (error) {
        console.error('Auto-resolve conflicts error:', error);
        res.status(500).json({ error: error.message || 'Failed to auto-resolve conflicts' });
    }
};
exports.autoResolveConflicts = autoResolveConflicts;
/**
 * Update device offline status
 */
const updateDeviceStatus = async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const userId = req.user.id;
        const update = {
            userId,
            ...req.body,
        };
        const status = await offline_status_service_1.default.updateDeviceStatus(update);
        res.json({
            success: true,
            message: 'Device status updated',
            status: {
                deviceId: status.deviceId,
                isOnline: status.isOnline,
                lastSeen: status.lastSeen,
                platform: status.platform,
                syncEnabled: status.syncEnabled,
                pendingSyncItems: status.pendingSyncItems,
            },
        });
    }
    catch (error) {
        console.error('Update device status error:', error);
        res.status(500).json({ error: error.message || 'Failed to update device status' });
    }
};
exports.updateDeviceStatus = updateDeviceStatus;
/**
 * Get device statuses
 */
const getDeviceStatuses = async (req, res) => {
    try {
        const userId = req.user.id;
        const { includeOffline = true } = req.query;
        const devices = await offline_status_service_1.default.getUserDevices(userId, includeOffline === 'true');
        res.json({
            success: true,
            devices: devices.map(device => ({
                deviceId: device.deviceId,
                isOnline: device.isOnline,
                lastSeen: device.lastSeen,
                platform: device.platform,
                appVersion: device.appVersion,
                syncEnabled: device.syncEnabled,
                pendingSyncItems: device.pendingSyncItems,
                lastSuccessfulSync: device.lastSuccessfulSync,
            })),
        });
    }
    catch (error) {
        console.error('Get device statuses error:', error);
        res.status(500).json({ error: error.message || 'Failed to get device statuses' });
    }
};
exports.getDeviceStatuses = getDeviceStatuses;
/**
 * Store offline data
 */
const storeOfflineData = async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const userId = req.user.id;
        const entity = req.body;
        const storedData = await offline_data_service_1.default.storeOfflineData(userId, entity);
        res.json({
            success: true,
            message: 'Offline data stored successfully',
            data: {
                id: storedData.id,
                entityType: storedData.entityType,
                entityId: storedData.entityId,
                version: storedData.version,
                syncStatus: storedData.syncStatus,
                expiresAt: storedData.expiresAt,
            },
        });
    }
    catch (error) {
        console.error('Store offline data error:', error);
        res.status(500).json({ error: error.message || 'Failed to store offline data' });
    }
};
exports.storeOfflineData = storeOfflineData;
/**
 * Sync offline data
 */
const syncOfflineData = async (req, res) => {
    try {
        const userId = req.user.id;
        const { entityTypes } = req.body;
        const result = await offline_data_service_1.default.syncOfflineData(userId, entityTypes);
        // Track sync performance
        await offline_analytics_service_1.default.trackSyncPerformance(userId, req.headers['x-device-id'] || 'unknown', {
            syncType: 'incremental',
            itemsSynced: result.synced,
            duration: 0, // Would need to track actual duration
            success: result.errors === 0,
            dataTransferred: 0, // Would need to calculate
        });
        res.json({
            success: true,
            message: `Synced ${result.synced} items, ${result.conflicts} conflicts, ${result.errors} errors`,
            result,
        });
    }
    catch (error) {
        console.error('Sync offline data error:', error);
        res.status(500).json({ error: error.message || 'Failed to sync offline data' });
    }
};
exports.syncOfflineData = syncOfflineData;
/**
 * Get offline data statistics
 */
const getOfflineDataStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const stats = await offline_data_service_1.default.getOfflineDataStats(userId);
        res.json({
            success: true,
            stats,
        });
    }
    catch (error) {
        console.error('Get offline data stats error:', error);
        res.status(500).json({ error: error.message || 'Failed to get offline data stats' });
    }
};
exports.getOfflineDataStats = getOfflineDataStats;
/**
 * Get data version history
 */
const getDataVersionHistory = async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        const versions = await data_versioning_service_1.default.getVersionHistory(entityType, entityId, parseInt(limit), parseInt(offset));
        res.json({
            success: true,
            versions: versions.map(version => ({
                id: version.id,
                version: version.version,
                operation: version.operation,
                userId: version.userId,
                checksum: version.checksum,
                createdAt: version.createdAt,
                metadata: version.metadata,
            })),
        });
    }
    catch (error) {
        console.error('Get version history error:', error);
        res.status(500).json({ error: error.message || 'Failed to get version history' });
    }
};
exports.getDataVersionHistory = getDataVersionHistory;
/**
 * Get offline analytics
 */
const getOfflineAnalytics = async (req, res) => {
    try {
        const userId = req.user.id;
        const { dateRange } = req.query;
        const report = await offline_analytics_service_1.default.generateOfflineReport(userId, dateRange && typeof dateRange === 'object' && 'start' in dateRange && 'end' in dateRange ? {
            start: new Date(dateRange.start),
            end: new Date(dateRange.end),
        } : undefined);
        res.json({
            success: true,
            report,
        });
    }
    catch (error) {
        console.error('Get offline analytics error:', error);
        res.status(500).json({ error: error.message || 'Failed to get offline analytics' });
    }
};
exports.getOfflineAnalytics = getOfflineAnalytics;
/**
 * Clear user cache
 */
const clearUserCache = async (req, res) => {
    try {
        const userId = req.user.id;
        const { entityTypes } = req.body;
        if (entityTypes && Array.isArray(entityTypes)) {
            for (const entityType of entityTypes) {
                await selective_cache_service_1.default.invalidateByType(entityType);
            }
        }
        else {
            // Clear all user-related cache
            await selective_cache_service_1.default.invalidateByType('user');
            await selective_cache_service_1.default.invalidateByType('post');
            await selective_cache_service_1.default.invalidateByType('event');
        }
        res.json({
            success: true,
            message: 'Cache cleared successfully',
        });
    }
    catch (error) {
        console.error('Clear cache error:', error);
        res.status(500).json({ error: error.message || 'Failed to clear cache' });
    }
};
exports.clearUserCache = clearUserCache;
/**
 * Get cache performance metrics
 */
const getCacheMetrics = async (req, res) => {
    try {
        const metrics = await selective_cache_service_1.default.getCacheMetrics();
        res.json({
            success: true,
            metrics,
        });
    }
    catch (error) {
        console.error('Get cache metrics error:', error);
        res.status(500).json({ error: error.message || 'Failed to get cache metrics' });
    }
};
exports.getCacheMetrics = getCacheMetrics;
