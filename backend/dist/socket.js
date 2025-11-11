"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSocketServer = void 0;
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const auth_utils_1 = require("./utils/auth.utils");
const database_1 = require("./config/database");
const createSocketServer = (app) => {
    const httpServer = (0, http_1.createServer)(app);
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: process.env.NODE_ENV === 'production'
                ? [process.env.CLIENT_URL || '', 'https://raved.app', 'https://www.raved.app']
                : true, // Allow all origins in development (needed for React Native)
            credentials: true
        }
    });
    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                return next(new Error('Authentication required'));
            }
            const decoded = (0, auth_utils_1.verifyToken)(token);
            if (!decoded) {
                return next(new Error('Invalid token'));
            }
            // Get user info
            const result = await database_1.pgPool.query('SELECT id, username, first_name, last_name FROM users WHERE id = $1 AND deleted_at IS NULL', [decoded.userId]);
            if (result.rows.length === 0) {
                return next(new Error('User not found'));
            }
            socket.userId = decoded.userId;
            socket.username = result.rows[0].username;
            next();
        }
        catch (error) {
            console.error('Socket auth error:', error);
            next(new Error('Authentication failed'));
        }
    });
    // Connection handling
    io.on('connection', (socket) => {
        console.log(`User ${socket.username} (${socket.userId}) connected`);
        // Join user-specific room
        socket.join(`user:${socket.userId}`);
        // Handle joining chat rooms
        socket.on('join_chat', (chatId) => {
            socket.join(`chat:${chatId}`);
            console.log(`User ${socket.username} joined chat ${chatId}`);
        });
        // Handle leaving chat rooms
        socket.on('leave_chat', (chatId) => {
            socket.leave(`chat:${chatId}`);
            console.log(`User ${socket.username} left chat ${chatId}`);
        });
        // Handle real-time messaging
        socket.on('send_message', async (data) => {
            try {
                const { chatService } = await Promise.resolve().then(() => __importStar(require('./services/chat.service')));
                // Save message to database
                const message = await chatService.sendMessage(data.chatId, socket.userId, data.content, data.type || 'text');
                // Emit to all users in the chat room
                io.to(`chat:${data.chatId}`).emit('new_message', {
                    ...message,
                    senderUsername: socket.username,
                    timestamp: new Date()
                });
            }
            catch (error) {
                console.error('Send message error:', error);
                socket.emit('message_error', { error: 'Failed to send message' });
            }
        });
        // Handle typing indicators
        socket.on('typing_start', (chatId) => {
            socket.to(`chat:${chatId}`).emit('user_typing', {
                userId: socket.userId,
                username: socket.username,
                chatId
            });
        });
        socket.on('typing_stop', (chatId) => {
            socket.to(`chat:${chatId}`).emit('user_stopped_typing', {
                userId: socket.userId,
                username: socket.username,
                chatId
            });
        });
        // Handle notifications
        socket.on('mark_notification_read', async (notificationId) => {
            try {
                const { pgPool } = await Promise.resolve().then(() => __importStar(require('./config/database')));
                // Mark notification as read in database
                const result = await pgPool.query('UPDATE notifications SET is_read = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *', [notificationId, socket.userId]);
                if (result.rows.length > 0) {
                    socket.emit('notification_updated', { notificationId, read: true });
                }
                else {
                    socket.emit('notification_error', { error: 'Notification not found' });
                }
            }
            catch (error) {
                console.error('Mark notification read error:', error);
                socket.emit('notification_error', { error: 'Failed to mark notification as read' });
            }
        });
        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`User ${socket.username} (${socket.userId}) disconnected`);
        });
    });
    return { httpServer, io };
};
exports.createSocketServer = createSocketServer;
