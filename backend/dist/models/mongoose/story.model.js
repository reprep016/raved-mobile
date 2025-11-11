"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Story = void 0;
const mongoose_1 = require("mongoose");
const StorySchema = new mongoose_1.Schema({
    userId: { type: String, required: true, index: true },
    type: {
        type: String,
        enum: ['image', 'video', 'template', 'text'],
        required: true
    },
    content: { type: String, required: true }, // URL or template ID
    text: String,
    thumbnail: String,
    allowReplies: { type: Boolean, default: true },
    addToHighlights: { type: Boolean, default: false },
    viewsCount: { type: Number, default: 0 },
    repliesCount: { type: Number, default: 0 },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
        index: true
    },
    createdAt: { type: Date, default: Date.now }
});
StorySchema.index({ userId: 1, expiresAt: -1 });
exports.Story = (0, mongoose_1.model)('Story', StorySchema);
