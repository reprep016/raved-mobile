import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import { verifyToken } from './utils/auth.utils';
import { pgPool } from './config/database';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

export const createSocketServer = (app: express.Application) => {
    const httpServer = createServer(app);
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.NODE_ENV === 'production'
                ? [process.env.CLIENT_URL || '', 'https://raved.app', 'https://www.raved.app']
                : true, // Allow all origins in development (needed for React Native)
            credentials: true
        }
    });

    // Authentication middleware
    io.use(async (socket: AuthenticatedSocket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

            if (!token) {
                return next(new Error('Authentication required'));
            }

            const decoded = verifyToken(token);
            if (!decoded) {
                return next(new Error('Invalid token'));
            }

            // Support tokens that carry `userId` or `id` in payload (matching auth middleware)
            const userId = decoded?.userId || decoded?.id;
            if (!userId) {
                return next(new Error('Invalid token: missing user identifier'));
            }

            // Get user info
            const result = await pgPool.query(
                'SELECT id, username, first_name, last_name FROM users WHERE id = $1 AND deleted_at IS NULL',
                [userId]
            );

            if (result.rows.length === 0) {
                return next(new Error('User not found'));
            }

            socket.userId = userId;
            socket.username = result.rows[0].username;
            next();
        } catch (error) {
            console.error('Socket auth error:', error);
            next(new Error('Authentication failed'));
        }
    });

    // Connection handling
    io.on('connection', (socket: AuthenticatedSocket) => {
        console.log(`User ${socket.username} (${socket.userId}) connected`);

        // Join user-specific room
        socket.join(`user:${socket.userId}`);

        // Handle joining chat rooms
        socket.on('join_chat', (chatId: string) => {
            socket.join(`chat:${chatId}`);
            console.log(`User ${socket.username} joined chat ${chatId}`);
        });

        // Handle leaving chat rooms
        socket.on('leave_chat', (chatId: string) => {
            socket.leave(`chat:${chatId}`);
            console.log(`User ${socket.username} left chat ${chatId}`);
        });

        // Handle real-time messaging
        socket.on('send_message', async (data: { chatId: string; content: string; type?: string }) => {
            try {
                const { chatService } = await import('./services/chat.service');

                // Save message to database
                const message = await chatService.sendMessage(data.chatId, socket.userId!, data.content, data.type || 'text');

                // Emit to all users in the chat room
                io.to(`chat:${data.chatId}`).emit('new_message', {
                    ...message,
                    senderUsername: socket.username,
                    timestamp: new Date()
                });
            } catch (error) {
                console.error('Send message error:', error);
                socket.emit('message_error', { error: 'Failed to send message' });
            }
        });

        // Handle typing indicators
        socket.on('typing_start', (chatId: string) => {
            socket.to(`chat:${chatId}`).emit('user_typing', {
                userId: socket.userId,
                username: socket.username,
                chatId
            });
        });

        socket.on('typing_stop', (chatId: string) => {
            socket.to(`chat:${chatId}`).emit('user_stopped_typing', {
                userId: socket.userId,
                username: socket.username,
                chatId
            });
        });

        // Handle notifications
        socket.on('mark_notification_read', async (notificationId: string) => {
            try {
                const { pgPool } = await import('./config/database');

                // Mark notification as read in database
                const result = await pgPool.query(
                    'UPDATE notifications SET is_read = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *',
                    [notificationId, socket.userId]
                );

                if (result.rows.length > 0) {
                    socket.emit('notification_updated', { notificationId, read: true });
                } else {
                    socket.emit('notification_error', { error: 'Notification not found' });
                }
            } catch (error) {
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
