"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataVersioningService = void 0;
const uuid_1 = require("uuid");
const data_version_model_1 = require("../models/postgres/data-version.model");
const database_1 = require("../config/database");
const crypto_1 = __importDefault(require("crypto"));
class DataVersioningService {
    /**
     * Create a new version record
     */
    static async createVersion(entity) {
        // Get current version number
        const currentVersion = await this.getLatestVersion(entity.entityType, entity.entityId);
        const newVersion = currentVersion + 1;
        const checksum = this.generateChecksum(entity.data);
        const versionData = {
            id: (0, uuid_1.v4)(),
            entityType: entity.entityType,
            entityId: entity.entityId,
            version: newVersion,
            userId: entity.userId,
            operation: entity.operation,
            data: entity.data,
            checksum,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: entity.metadata,
        };
        const version = await data_version_model_1.DataVersion.create(versionData);
        // Update latest version cache
        await this.updateLatestVersionCache(entity.entityType, entity.entityId, newVersion, version.id);
        return version;
    }
    /**
     * Get the latest version of an entity
     */
    static async getLatestVersion(entityType, entityId) {
        // Check cache first
        const cacheKey = `${this.LATEST_VERSION_KEY_PREFIX}${entityType}:${entityId}`;
        const cachedVersion = await database_1.redis.get(cacheKey);
        if (cachedVersion) {
            return parseInt(cachedVersion);
        }
        // Query database
        const latestVersion = await data_version_model_1.DataVersion.findOne({
            where: { entityType, entityId },
            order: [['version', 'DESC']],
            attributes: ['version'],
        });
        const version = latestVersion ? latestVersion.version : 0;
        // Cache the result
        await database_1.redis.setex(cacheKey, 3600, version.toString()); // 1 hour
        return version;
    }
    /**
     * Get version history for an entity
     */
    static async getVersionHistory(entityType, entityId, limit = 50, offset = 0) {
        return data_version_model_1.DataVersion.findAll({
            where: { entityType, entityId },
            order: [['version', 'DESC']],
            limit,
            offset,
        });
    }
    /**
     * Get a specific version of an entity
     */
    static async getVersion(entityType, entityId, version) {
        return data_version_model_1.DataVersion.findOne({
            where: { entityType, entityId, version },
        });
    }
    /**
     * Compare two versions of an entity
     */
    static async compareVersions(entityType, entityId, version1, version2) {
        const [v1, v2] = await Promise.all([
            this.getVersion(entityType, entityId, version1),
            this.getVersion(entityType, entityId, version2),
        ]);
        const differences = this.calculateDifferences(v1?.data || {}, v2?.data || {});
        return {
            version1: v1,
            version2: v2,
            differences,
        };
    }
    /**
     * Rollback to a specific version
     */
    static async rollbackToVersion(entityType, entityId, targetVersion, userId) {
        const targetVersionData = await this.getVersion(entityType, entityId, targetVersion);
        if (!targetVersionData) {
            throw new Error(`Version ${targetVersion} not found`);
        }
        // Create a new version with the rolled back data
        return this.createVersion({
            entityType,
            entityId,
            data: targetVersionData.data,
            userId,
            operation: 'update',
            metadata: {
                rollbackFrom: await this.getLatestVersion(entityType, entityId),
                rollbackTo: targetVersion,
                rolledBackBy: userId,
            },
        });
    }
    /**
     * Get version statistics
     */
    static async getVersionStats(entityType, entityId, userId) {
        const whereClause = {};
        if (entityType)
            whereClause.entityType = entityType;
        if (entityId)
            whereClause.entityId = entityId;
        if (userId)
            whereClause.userId = userId;
        const [totalVersions, entitiesTracked, operationsStats] = await Promise.all([
            data_version_model_1.DataVersion.count({ where: whereClause }),
            data_version_model_1.DataVersion.count({
                where: whereClause,
                distinct: true,
                col: 'entityId',
            }),
            data_version_model_1.DataVersion.findAll({
                where: whereClause,
                attributes: [
                    'operation',
                    [require('sequelize').fn('COUNT', require('sequelize').col('operation')), 'count'],
                ],
                group: ['operation'],
                raw: true,
            }),
        ]);
        const operationsBreakdown = {};
        operationsStats.forEach((stat) => {
            operationsBreakdown[stat.operation] = parseInt(stat.count);
        });
        return {
            totalVersions,
            entitiesTracked,
            averageVersionsPerEntity: entitiesTracked > 0 ? totalVersions / entitiesTracked : 0,
            operationsBreakdown,
        };
    }
    /**
     * Validate data integrity using checksums
     */
    static async validateIntegrity(entityType, entityId, version) {
        const whereClause = { entityType, entityId };
        if (version)
            whereClause.version = version;
        const versions = await data_version_model_1.DataVersion.findAll({
            where: whereClause,
            order: [['version', 'ASC']],
        });
        const corruptedVersions = [];
        for (const version of versions) {
            const expectedChecksum = this.generateChecksum(version.data);
            if (expectedChecksum !== version.checksum) {
                corruptedVersions.push(version.version);
            }
        }
        return {
            isValid: corruptedVersions.length === 0,
            corruptedVersions,
        };
    }
    /**
     * Clean up old versions (keep only recent ones)
     */
    static async cleanupOldVersions(entityType, entityId, keepVersions = 10) {
        // Get versions to keep
        const recentVersions = await data_version_model_1.DataVersion.findAll({
            where: { entityType, entityId },
            order: [['version', 'DESC']],
            limit: keepVersions,
            attributes: ['version'],
        });
        const versionsToKeep = recentVersions.map(v => v.version);
        // Delete older versions
        const result = await data_version_model_1.DataVersion.destroy({
            where: {
                entityType,
                entityId,
                version: { [require('sequelize').Op.notIn]: versionsToKeep },
            },
        });
        return result;
    }
    /**
     * Bulk create versions (for initial data migration)
     */
    static async bulkCreateVersions(versions) {
        const versionRecords = versions.map(entity => ({
            id: (0, uuid_1.v4)(),
            entityType: entity.entityType,
            entityId: entity.entityId,
            version: 1, // Will be updated based on existing versions
            userId: entity.userId,
            operation: entity.operation,
            data: entity.data,
            checksum: this.generateChecksum(entity.data),
            createdAt: new Date(),
            updatedAt: new Date(),
        }));
        // For bulk operations, we need to handle versions sequentially
        const createdVersions = [];
        for (const record of versionRecords) {
            // Get current version for this entity
            const currentVersion = await this.getLatestVersion(record.entityType, record.entityId);
            record.version = currentVersion + 1;
            const version = await data_version_model_1.DataVersion.create(record);
            createdVersions.push(version);
            // Update cache
            await this.updateLatestVersionCache(record.entityType, record.entityId, record.version, record.id);
        }
        return createdVersions;
    }
    /**
     * Update latest version cache
     */
    static async updateLatestVersionCache(entityType, entityId, version, versionId) {
        const cacheKey = `${this.LATEST_VERSION_KEY_PREFIX}${entityType}:${entityId}`;
        await database_1.redis.setex(cacheKey, 3600, version.toString()); // 1 hour
        // Also cache the version data
        const versionCacheKey = `${this.VERSION_KEY_PREFIX}${entityType}:${entityId}:${version}`;
        const versionData = await data_version_model_1.DataVersion.findByPk(versionId);
        if (versionData) {
            await database_1.redis.setex(versionCacheKey, 3600, JSON.stringify(versionData.toJSON()));
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
     * Calculate differences between two data objects
     */
    static calculateDifferences(data1, data2) {
        const differences = [];
        const keys1 = Object.keys(data1 || {});
        const keys2 = Object.keys(data2 || {});
        const allKeys = new Set([...keys1, ...keys2]);
        for (const key of allKeys) {
            const value1 = data1?.[key];
            const value2 = data2?.[key];
            if (value1 === undefined && value2 !== undefined) {
                differences.push(`Added: ${key} = ${JSON.stringify(value2)}`);
            }
            else if (value1 !== undefined && value2 === undefined) {
                differences.push(`Removed: ${key} = ${JSON.stringify(value1)}`);
            }
            else if (!this.deepEqual(value1, value2)) {
                differences.push(`Changed: ${key} from ${JSON.stringify(value1)} to ${JSON.stringify(value2)}`);
            }
        }
        return differences;
    }
    /**
     * Deep equality check
     */
    static deepEqual(a, b) {
        if (a === b)
            return true;
        if (a == null || b == null)
            return a === b;
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length)
                return false;
            for (let i = 0; i < a.length; i++) {
                if (!this.deepEqual(a[i], b[i]))
                    return false;
            }
            return true;
        }
        if (typeof a === 'object' && typeof b === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            if (keysA.length !== keysB.length)
                return false;
            for (const key of keysA) {
                if (!keysB.includes(key))
                    return false;
                if (!this.deepEqual(a[key], b[key]))
                    return false;
            }
            return true;
        }
        return false;
    }
}
exports.DataVersioningService = DataVersioningService;
DataVersioningService.VERSION_KEY_PREFIX = 'data_version:';
DataVersioningService.LATEST_VERSION_KEY_PREFIX = 'latest_version:';
exports.default = DataVersioningService;
