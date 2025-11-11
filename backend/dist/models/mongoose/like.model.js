"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Like = void 0;
const mongoose_1 = require("mongoose");
const LikeSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    targetId: { type: String, required: true, index: true }, // Post or Comment ID
    targetType: { type: String, enum: ['post', 'comment'], required: true },
    createdAt: { type: Date, default: Date.now }
});
LikeSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });
exports.Like = (0, mongoose_1.model)('Like', LikeSchema);
