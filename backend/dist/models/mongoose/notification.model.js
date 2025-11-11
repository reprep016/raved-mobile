"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Notification = void 0;
const mongoose_1 = require("mongoose");
const NotificationSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    type: {
        type: String,
        enum: ['like', 'comment', 'follow', 'mention', 'message', 'sale', 'event'],
        required: true
    },
    actorId: String,
    referenceType: String, // 'post', 'comment', 'item', 'event'
    referenceId: String,
    title: String,
    message: String,
    imageUrl: String,
    isRead: { type: Boolean, default: false },
    readAt: Date,
    createdAt: { type: Date, default: Date.now, index: true }
});
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
exports.Notification = (0, mongoose_1.model)('Notification', NotificationSchema);
