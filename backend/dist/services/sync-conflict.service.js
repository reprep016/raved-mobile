"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncConflictService = void 0;
const uuid_1 = require("uuid");
const sync_conflict_model_1 = require("../models/postgres/sync-conflict.model");
const data_version_model_1 = require("../models/postgres/data-version.model");
const database_1 = require("../config/database");
const crypto_1 = __importDefault(require("crypto"));
class SyncConflictService {
    /**
     * Detect and create a sync conflict
     */
    static async detectConflict(userId, entityType, entityId, localVersion, serverVersion, localData, serverData, conflictType = 'update') {
        // Check if versions are different
        if (localVersion === serverVersion) {
            return null; // No conflict
        }
        // Check if conflict already exists
        const existingConflict = await sync_conflict_model_1.SyncConflict.findOne({
            where: {
                userId,
                entityType,
                entityId,
                resolved: false,
            },
        });
        if (existingConflict) {
            // Update existing conflict with latest data
            await existingConflict.update({
                localVersion,
                serverVersion,
                localData,
                serverData,
                conflictType,
                updatedAt: new Date(),
            });
            return existingConflict;
        }
        // Create new conflict
        const conflictData = {
            id: (0, uuid_1.v4)(),
            userId,
            entityType,
            entityId,
            localVersion,
            serverVersion,
            localData,
            serverData,
            conflictType,
            resolutionStrategy: 'manual',
            resolved: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const conflict = await sync_conflict_model_1.SyncConflict.create(conflictData);
        // Cache conflict for quick access
        await this.cacheConflict(conflict);
        return conflict;
    }
    /**
     * Resolve a sync conflict
     */
    static async resolveConflict(conflictId, resolution) {
        const conflict = await sync_conflict_model_1.SyncConflict.findByPk(conflictId);
        if (!conflict) {
            throw new Error('Conflict not found');
        }
        if (conflict.resolved) {
            throw new Error('Conflict already resolved');
        }
        let resolvedData = resolution.resolvedData;
        // Apply resolution strategy
        switch (resolution.strategy) {
            case 'local_wins':
                resolvedData = conflict.localData;
                break;
            case 'server_wins':
                resolvedData = conflict.serverData;
                break;
            case 'merge':
                resolvedData = this.mergeData(conflict.localData, conflict.serverData);
                break;
            case 'manual':
                if (!resolvedData) {
                    throw new Error('Manual resolution requires resolvedData');
                }
                break;
        }
        // Update conflict
        await conflict.update({
            resolutionStrategy: resolution.strategy,
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy: resolution.resolvedBy,
            updatedAt: new Date(),
        });
        // Create new version record
        await this.createVersionRecord(conflict, resolvedData, resolution.resolvedBy);
        // Remove from cache
        await this.removeCachedConflict(conflictId);
        return conflict;
    }
    /**
     * Auto-resolve conflicts based on predefined rules
     */
    static async autoResolveConflicts(userId, entityType, rules) {
        const conflicts = await sync_conflict_model_1.SyncConflict.findAll({
            where: {
                userId,
                entityType,
                resolved: false,
            },
        });
        let resolvedCount = 0;
        for (const conflict of conflicts) {
            try {
                let strategy = rules?.defaultStrategy || 'server_wins';
                let resolvedData = conflict.serverData;
                if (strategy === 'merge' && rules?.fieldPriorities) {
                    resolvedData = this.mergeDataWithPriorities(conflict.localData, conflict.serverData, rules.fieldPriorities);
                }
                else if (strategy === 'local_wins') {
                    resolvedData = conflict.localData;
                }
                await this.resolveConflict(conflict.id, {
                    strategy,
                    resolvedData,
                    resolvedBy: 'auto-resolver',
                });
                resolvedCount++;
            }
            catch (error) {
                console.error(`Failed to auto-resolve conflict ${conflict.id}:`, error);
            }
        }
        return resolvedCount;
    }
    /**
     * Get unresolved conflicts for a user
     */
    static async getUnresolvedConflicts(userId, entityType, limit = 50, offset = 0) {
        const whereClause = {
            userId,
            resolved: false,
        };
        if (entityType) {
            whereClause.entityType = entityType;
        }
        return sync_conflict_model_1.SyncConflict.findAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });
    }
    /**
     * Get conflict statistics
     */
    static async getConflictStats(userId) {
        const [total, resolved, unresolved] = await Promise.all([
            sync_conflict_model_1.SyncConflict.count({ where: { userId } }),
            sync_conflict_model_1.SyncConflict.count({ where: { userId, resolved: true } }),
            sync_conflict_model_1.SyncConflict.count({ where: { userId, resolved: false } }),
        ]);
        const byEntityType = await sync_conflict_model_1.SyncConflict.findAll({
            where: { userId },
            attributes: [
                'entityType',
                [require('sequelize').fn('COUNT', require('sequelize').col('entityType')), 'count'],
            ],
            group: ['entityType'],
            raw: true,
        });
        const byStrategy = await sync_conflict_model_1.SyncConflict.findAll({
            where: { userId, resolved: true },
            attributes: [
                'resolutionStrategy',
                [require('sequelize').fn('COUNT', require('sequelize').col('resolutionStrategy')), 'count'],
            ],
            group: ['resolutionStrategy'],
            raw: true,
        });
        const entityTypeStats = {};
        byEntityType.forEach((stat) => {
            entityTypeStats[stat.entityType] = parseInt(stat.count);
        });
        const strategyStats = {};
        byStrategy.forEach((stat) => {
            strategyStats[stat.resolutionStrategy] = parseInt(stat.count);
        });
        return {
            total,
            resolved,
            unresolved,
            byEntityType: entityTypeStats,
            byStrategy: strategyStats,
        };
    }
    /**
     * Merge data from local and server versions
     */
    static mergeData(localData, serverData) {
        if (!localData || !serverData) {
            return localData || serverData;
        }
        if (typeof localData !== 'object' || typeof serverData !== 'object') {
            // For primitive values, prefer server data
            return serverData;
        }
        const merged = { ...serverData };
        // Merge local data, preferring local for conflicts
        for (const key in localData) {
            if (!(key in serverData)) {
                merged[key] = localData[key];
            }
            else if (this.isObject(localData[key]) && this.isObject(serverData[key])) {
                merged[key] = this.mergeData(localData[key], serverData[key]);
            }
            // Keep server value for primitive conflicts
        }
        return merged;
    }
    /**
     * Merge data with field-level priorities
     */
    static mergeDataWithPriorities(localData, serverData, priorities) {
        const merged = { ...serverData };
        for (const key in localData) {
            const priority = priorities[key];
            if (priority === 'local') {
                merged[key] = localData[key];
            }
            else if (priority === 'server') {
                // Keep server value (already in merged)
            }
            else if (this.isObject(localData[key]) && this.isObject(serverData[key])) {
                merged[key] = this.mergeDataWithPriorities(localData[key], serverData[key], priorities);
            }
        }
        return merged;
    }
    /**
     * Create a version record after conflict resolution
     */
    static async createVersionRecord(conflict, resolvedData, resolvedBy) {
        const checksum = this.generateChecksum(resolvedData);
        await data_version_model_1.DataVersion.create({
            id: (0, uuid_1.v4)(),
            entityType: conflict.entityType,
            entityId: conflict.entityId,
            version: Math.max(conflict.localVersion, conflict.serverVersion) + 1,
            userId: conflict.userId,
            operation: 'update', // Conflict resolution is always an update
            data: resolvedData,
            checksum,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {
                resolvedConflictId: conflict.id,
                resolvedBy,
                resolutionStrategy: conflict.resolutionStrategy,
            },
        });
    }
    /**
     * Cache conflict for quick access
     */
    static async cacheConflict(conflict) {
        const cacheKey = `${this.CONFLICT_KEY_PREFIX}${conflict.userId}:${conflict.entityType}:${conflict.entityId}`;
        await database_1.redis.setex(cacheKey, 3600, JSON.stringify(conflict.toJSON())); // 1 hour
    }
    /**
     * Remove cached conflict
     */
    static async removeCachedConflict(conflictId) {
        // Find and remove from cache
        const conflict = await sync_conflict_model_1.SyncConflict.findByPk(conflictId);
        if (conflict) {
            const cacheKey = `${this.CONFLICT_KEY_PREFIX}${conflict.userId}:${conflict.entityType}:${conflict.entityId}`;
            await database_1.redis.del(cacheKey);
        }
    }
    /**
     * Generate checksum for data integrity
     */
    static generateChecksum(data) {
        const dataString = JSON.stringify(data, Object.keys(data).sort());
        return crypto_1.default.createHash('sha256').update(dataString).digest('hex');
    }
    /**
     * Check if value is an object
     */
    static isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
    /**
     * Clean up old resolved conflicts
     */
    static async cleanupResolvedConflicts(daysOld = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const result = await sync_conflict_model_1.SyncConflict.destroy({
            where: {
                resolved: true,
                resolvedAt: { [require('sequelize').Op.lt]: cutoffDate },
            },
        });
        return result;
    }
}
exports.SyncConflictService = SyncConflictService;
SyncConflictService.CONFLICT_KEY_PREFIX = 'sync_conflict:';
exports.default = SyncConflictService;
