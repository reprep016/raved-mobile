"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsController = void 0;
const push_notification_service_1 = require("../services/push-notification.service");
const notification_model_1 = require("../models/mongoose/notification.model");
exports.notificationsController = {
    // Send test notification to user
    sendTestNotification: async (req, res) => {
        try {
            const userId = req.user.id;
            const { message } = req.body;
            if (!message) {
                return res.status(400).json({
                    error: 'Message is required'
                });
            }
            await push_notification_service_1.PushNotificationService.sendPushNotification(userId, 'Test Notification', message, { type: 'test' });
            res.json({
                success: true,
                message: 'Test notification sent successfully'
            });
        }
        catch (error) {
            console.error('Send Test Notification Error:', error);
            res.status(500).json({ error: 'Failed to send test notification' });
        }
    },
    // Send notification to specific user
    sendNotificationToUser: async (req, res) => {
        try {
            const { userId, title, body, data } = req.body;
            if (!userId || !title || !body) {
                return res.status(400).json({
                    error: 'userId, title, and body are required'
                });
            }
            await push_notification_service_1.PushNotificationService.sendPushNotification(userId, title, body, data);
            res.json({
                success: true,
                message: 'Notification sent successfully'
            });
        }
        catch (error) {
            console.error('Send Notification Error:', error);
            res.status(500).json({ error: 'Failed to send notification' });
        }
    },
    // Send notification to multiple users
    sendNotificationToUsers: async (req, res) => {
        try {
            const { userIds, title, body, data } = req.body;
            if (!userIds || !Array.isArray(userIds) || !title || !body) {
                return res.status(400).json({
                    error: 'userIds (array), title, and body are required'
                });
            }
            await push_notification_service_1.PushNotificationService.sendNotificationToMultipleUsers(userIds, title, body, data);
            res.json({
                success: true,
                message: `Notification sent to ${userIds.length} users`
            });
        }
        catch (error) {
            console.error('Send Multiple Notifications Error:', error);
            res.status(500).json({ error: 'Failed to send notifications' });
        }
    },
    // Get user's notification preferences
    getNotificationPreferences: async (req, res) => {
        try {
            const userId = req.user.id;
            // For now, return default preferences
            // In a real implementation, you'd fetch from database
            const preferences = {
                pushEnabled: true,
                likes: true,
                comments: true,
                follows: true,
                mentions: true,
                messages: true,
                events: true,
                sales: true,
                marketing: false,
                soundEnabled: true,
                vibrationEnabled: true,
            };
            res.json({
                success: true,
                preferences
            });
        }
        catch (error) {
            console.error('Get Notification Preferences Error:', error);
            res.status(500).json({ error: 'Failed to get notification preferences' });
        }
    },
    // Update user's notification preferences
    updateNotificationPreferences: async (req, res) => {
        try {
            const userId = req.user.id;
            const { preferences } = req.body;
            if (!preferences || typeof preferences !== 'object') {
                return res.status(400).json({
                    error: 'Preferences object is required'
                });
            }
            // In a real implementation, you'd save to database
            // For now, just validate and return success
            const validKeys = [
                'pushEnabled', 'likes', 'comments', 'follows', 'mentions',
                'messages', 'events', 'sales', 'marketing', 'soundEnabled', 'vibrationEnabled'
            ];
            const filteredPreferences = {};
            for (const key of validKeys) {
                if (typeof preferences[key] === 'boolean') {
                    filteredPreferences[key] = preferences[key];
                }
            }
            res.json({
                success: true,
                message: 'Notification preferences updated successfully',
                preferences: filteredPreferences
            });
        }
        catch (error) {
            console.error('Update Notification Preferences Error:', error);
            res.status(500).json({ error: 'Failed to update notification preferences' });
        }
    },
    // Create notification
    createNotification: async (userId, type, title, message, actorId, data) => {
        try {
            // Create notification record in database
            const notification = await notification_model_1.Notification.create({
                userId,
                type,
                title,
                message,
                actorId,
                data
            });
            // Send push notification
            await push_notification_service_1.PushNotificationService.sendPushNotification(userId, title, message, data ? Object.keys(data).reduce((acc, key) => {
                acc[key] = String(data[key]);
                return acc;
            }, {}) : undefined);
            return notification;
        }
        catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    },
};
