import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { notificationsController } from '../controllers/notifications.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Send test notification
router.post('/test', notificationsController.sendTestNotification);

// Send notification to user
router.post('/send', notificationsController.sendNotificationToUser);

// Send notification to multiple users
router.post('/send-multiple', notificationsController.sendNotificationToUsers);

// Get user's notifications
router.get('/', notificationsController.getNotifications);

// Mark notification as read
router.put('/:notificationId/read', notificationsController.markAsRead);

// Mark all notifications as read
router.put('/read-all', notificationsController.markAllAsRead);

// Get notification preferences
router.get('/preferences', notificationsController.getNotificationPreferences);

// Update notification preferences
router.put('/preferences', notificationsController.updateNotificationPreferences);

export default router;