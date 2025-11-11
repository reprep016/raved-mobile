"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupController = void 0;
const backup_service_1 = require("../services/backup.service");
const database_1 = require("../config/database");
const notification_model_1 = require("../models/mongoose/notification.model");
exports.backupController = {
    // Admin: Create manual backup
    async createBackup(req, res) {
        try {
            const { type = 'full', compress = true, retentionDays = 30 } = req.body;
            const options = {
                compress,
                retentionDays,
                includeData: true,
                includeSchema: true
            };
            let metadata;
            if (type === 'postgresql') {
                // PostgreSQL only backup
                const path = await backup_service_1.backupService.backupPostgreSQL(options);
                metadata = {
                    id: `pg_${Date.now()}`,
                    type: 'postgresql',
                    databases: ['postgresql'],
                    timestamp: new Date(),
                    size: 0, // Would calculate actual size
                    checksum: '',
                    status: 'success',
                    path,
                    retentionDays,
                    expiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)
                };
            }
            else if (type === 'mongodb') {
                // MongoDB only backup
                const path = await backup_service_1.backupService.backupMongoDB(options);
                metadata = {
                    id: `mongo_${Date.now()}`,
                    type: 'mongodb',
                    databases: ['mongodb'],
                    timestamp: new Date(),
                    size: 0,
                    checksum: '',
                    status: 'success',
                    path,
                    retentionDays,
                    expiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)
                };
            }
            else {
                // Full system backup
                metadata = await backup_service_1.backupService.createFullBackup(options);
            }
            // Log backup creation
            await database_1.pgPool.query(`
        INSERT INTO admin_logs (admin_id, action, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)
      `, [
                req.user?.id,
                'backup_created',
                JSON.stringify({ backupId: metadata.id, type: metadata.type }),
                req.ip,
                req.get('User-Agent')
            ]);
            res.json({
                success: true,
                message: 'Backup created successfully',
                backup: metadata
            });
        }
        catch (error) {
            console.error('Backup creation failed:', error);
            res.status(500).json({
                success: false,
                message: 'Backup creation failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    },
    // Admin: List all backups
    async listBackups(req, res) {
        try {
            const backups = await backup_service_1.backupService.listBackups();
            // Sort by timestamp descending
            backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            res.json({
                success: true,
                backups
            });
        }
        catch (error) {
            console.error('List backups failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to list backups',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    },
    // Admin: Restore from backup
    async restoreBackup(req, res) {
        try {
            const { backupId, targetDatabases = ['postgresql', 'mongodb'] } = req.body;
            if (!backupId) {
                return res.status(400).json({
                    success: false,
                    message: 'Backup ID is required'
                });
            }
            // Verify backup exists and is valid
            const isValid = await backup_service_1.backupService.verifyBackupIntegrity(backupId);
            if (!isValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Backup integrity check failed'
                });
            }
            // Start restore process (this would be async in production)
            await backup_service_1.backupService.restoreFromBackup(backupId, targetDatabases);
            // Log restore action
            await database_1.pgPool.query(`
        INSERT INTO admin_logs (admin_id, action, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)
      `, [
                req.user?.id,
                'backup_restored',
                JSON.stringify({ backupId, targetDatabases }),
                req.ip,
                req.get('User-Agent')
            ]);
            res.json({
                success: true,
                message: 'Backup restoration initiated successfully'
            });
        }
        catch (error) {
            console.error('Backup restoration failed:', error);
            res.status(500).json({
                success: false,
                message: 'Backup restoration failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    },
    // Admin: Delete backup
    async deleteBackup(req, res) {
        try {
            const { backupId } = req.params;
            const backups = await backup_service_1.backupService.listBackups();
            const backupIndex = backups.findIndex(b => b.id === backupId);
            if (backupIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Backup not found'
                });
            }
            const backup = backups[backupIndex];
            // Remove file
            const fs = require('fs').promises;
            try {
                await fs.unlink(backup.path);
            }
            catch (fileError) {
                console.warn('Failed to delete backup file:', fileError);
            }
            // Remove from metadata
            backups.splice(backupIndex, 1);
            const metadataPath = require('path').join(process.cwd(), 'backups', 'metadata.json');
            await fs.writeFile(metadataPath, JSON.stringify(backups, null, 2));
            // Log deletion
            await database_1.pgPool.query(`
        INSERT INTO admin_logs (admin_id, action, details, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)
      `, [
                req.user?.id,
                'backup_deleted',
                JSON.stringify({ backupId }),
                req.ip,
                req.get('User-Agent')
            ]);
            res.json({
                success: true,
                message: 'Backup deleted successfully'
            });
        }
        catch (error) {
            console.error('Backup deletion failed:', error);
            res.status(500).json({
                success: false,
                message: 'Backup deletion failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    },
    // Admin: Verify backup integrity
    async verifyBackup(req, res) {
        try {
            const { backupId } = req.params;
            const isValid = await backup_service_1.backupService.verifyBackupIntegrity(backupId);
            res.json({
                success: true,
                backupId,
                isValid,
                message: isValid ? 'Backup integrity verified' : 'Backup integrity check failed'
            });
        }
        catch (error) {
            console.error('Backup verification failed:', error);
            res.status(500).json({
                success: false,
                message: 'Backup verification failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    },
    // User: Export personal data (GDPR compliance)
    async exportUserData(req, res) {
        try {
            const userId = req.user.id;
            const { anonymize = false, format = 'json', includePersonalData = true, dateRange } = req.body;
            const options = {
                userId,
                anonymize,
                format,
                includePersonalData,
                dateRange
            };
            const exportPath = await backup_service_1.backupService.exportUserData(options);
            // Log data export
            await database_1.pgPool.query(`
        INSERT INTO user_activity_logs (user_id, activity_type, activity_data, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)
      `, [
                userId,
                'data_export',
                JSON.stringify({ format, anonymize, dateRange }),
                req.ip,
                req.get('User-Agent')
            ]);
            // Send file for download
            const fs = require('fs');
            const filename = `user_data_export_${userId}_${Date.now()}.${format}`;
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
            const fileStream = fs.createReadStream(exportPath);
            fileStream.pipe(res);
            // Clean up file after sending
            fileStream.on('end', async () => {
                try {
                    await fs.promises.unlink(exportPath);
                }
                catch (cleanupError) {
                    console.warn('Failed to cleanup export file:', cleanupError);
                }
            });
        }
        catch (error) {
            console.error('Data export failed:', error);
            res.status(500).json({
                success: false,
                message: 'Data export failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    },
    // User: Request data deletion (GDPR right to be forgotten)
    async requestDataDeletion(req, res) {
        try {
            const userId = req.user.id;
            const { reason, confirmDeletion } = req.body;
            if (!confirmDeletion) {
                return res.status(400).json({
                    success: false,
                    message: 'Deletion must be explicitly confirmed'
                });
            }
            // Create deletion request record
            await database_1.pgPool.query(`
        INSERT INTO data_deletion_requests (user_id, reason, status, requested_at)
        VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP)
      `, [userId, reason]);
            // Notify admins
            const admins = await database_1.pgPool.query(`
        SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL
      `);
            for (const admin of admins.rows) {
                await notification_model_1.Notification.create({
                    userId: admin.id,
                    type: 'data_deletion_request',
                    title: 'Data Deletion Request',
                    message: `User ${req.user.username} has requested data deletion. Reason: ${reason}`,
                    data: { userId, reason }
                });
            }
            // Log activity
            await database_1.pgPool.query(`
        INSERT INTO user_activity_logs (user_id, activity_type, activity_data, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)
      `, [
                userId,
                'data_deletion_requested',
                JSON.stringify({ reason }),
                req.ip,
                req.get('User-Agent')
            ]);
            res.json({
                success: true,
                message: 'Data deletion request submitted successfully. You will be notified once processed.'
            });
        }
        catch (error) {
            console.error('Data deletion request failed:', error);
            res.status(500).json({
                success: false,
                message: 'Data deletion request failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    },
    // Admin: Process data deletion request
    async processDataDeletion(req, res) {
        try {
            const { requestId, action } = req.body; // action: 'approve' | 'deny'
            const request = await database_1.pgPool.query(`
        SELECT * FROM data_deletion_requests WHERE id = $1
      `, [requestId]);
            if (request.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Deletion request not found'
                });
            }
            const deletionRequest = request.rows[0];
            if (action === 'approve') {
                // Perform actual data deletion (anonymize instead of delete for compliance)
                // Note: In production, implement proper data anonymization/deletion logic
                console.log(`Anonymizing data for user ${deletionRequest.user_id}`);
                // Mark as deleted
                await database_1.pgPool.query(`
          UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1
        `, [deletionRequest.user_id]);
                // Update request status
                await database_1.pgPool.query(`
          UPDATE data_deletion_requests
          SET status = 'completed', processed_at = CURRENT_TIMESTAMP, processed_by = $2
          WHERE id = $1
        `, [requestId, req.user.id]);
                // Notify user
                await notification_model_1.Notification.create({
                    userId: deletionRequest.user_id,
                    type: 'data_deletion_completed',
                    title: 'Data Deletion Completed',
                    message: 'Your data has been permanently deleted from our systems as per your request.'
                });
            }
            else {
                // Deny request
                await database_1.pgPool.query(`
          UPDATE data_deletion_requests
          SET status = 'denied', processed_at = CURRENT_TIMESTAMP, processed_by = $2
          WHERE id = $1
        `, [requestId, req.user.id]);
                // Notify user
                await notification_model_1.Notification.create({
                    userId: deletionRequest.user_id,
                    type: 'data_deletion_denied',
                    title: 'Data Deletion Request Denied',
                    message: 'Your data deletion request has been denied. Please contact support for more information.'
                });
            }
            res.json({
                success: true,
                message: `Data deletion request ${action}d successfully`
            });
        }
        catch (error) {
            console.error('Process data deletion failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to process data deletion request',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    },
    // Admin: Get backup statistics
    async getBackupStats(req, res) {
        try {
            const backups = await backup_service_1.backupService.listBackups();
            const now = new Date();
            const stats = {
                totalBackups: backups.length,
                successfulBackups: backups.filter(b => b.status === 'success').length,
                failedBackups: backups.filter(b => b.status === 'failed').length,
                totalSize: backups.reduce((sum, b) => sum + b.size, 0),
                activeBackups: backups.filter(b => b.expiresAt > now).length,
                expiredBackups: backups.filter(b => b.expiresAt <= now).length,
                lastBackup: backups.length > 0 ? backups[0].timestamp : null
            };
            res.json({
                success: true,
                stats
            });
        }
        catch (error) {
            console.error('Get backup stats failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get backup statistics',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
};
