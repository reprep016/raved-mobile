"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Comment = void 0;
const mongoose_1 = require("mongoose");
const CommentSchema = new mongoose_1.Schema({
    postId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    text: { type: String, required: true, maxlength: 500 },
    parentCommentId: { type: String, default: null }, // For nested replies
    likesCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    deletedAt: Date
});
CommentSchema.index({ postId: 1, createdAt: -1 });
exports.Comment = (0, mongoose_1.model)('Comment', CommentSchema);
