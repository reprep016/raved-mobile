"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const notifications_controller_1 = require("../controllers/notifications.controller");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticate);
// Send test notification
router.post('/test', notifications_controller_1.notificationsController.sendTestNotification);
// Send notification to user
router.post('/send', notifications_controller_1.notificationsController.sendNotificationToUser);
// Send notification to multiple users
router.post('/send-multiple', notifications_controller_1.notificationsController.sendNotificationToUsers);
// Get notification preferences
router.get('/preferences', notifications_controller_1.notificationsController.getNotificationPreferences);
// Update notification preferences
router.put('/preferences', notifications_controller_1.notificationsController.updateNotificationPreferences);
exports.default = router;
