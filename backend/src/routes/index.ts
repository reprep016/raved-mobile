import { Router } from 'express';
import authRoutes from './auth.routes';
import postRoutes from './posts.routes';
import storyRoutes from './stories.routes';
import storeRoutes from './store.routes';
import themeRoutes from './theme.routes';
import connectionRoutes from './connection.routes';
import cartRoutes from './cart.routes';
import paymentRoutes from './payment.routes';
import adminRoutes from './admin.routes';
import searchRoutes from './search.routes';
import eventsRoutes from './events.routes';
import notificationsRoutes from './notifications.routes';
import deviceTokenRoutes from './device-token.routes';
import chatRoutes from './chat.routes';
import uploadRoutes from './upload.routes';
import analyticsRoutes from './analytics.routes';
import backupRoutes from './backup.routes';
import rateLimitRoutes from './rate-limit.routes';
import offlineSyncRoutes from './offline-sync.routes';
import moderationRoutes from './moderation.routes';
import facultiesRoutes from './faculties.routes';
import rankingsRoutes from './rankings.routes';
import subscriptionsRoutes from './subscriptions.routes';
import usersRoutes from './users.routes';
import supportRoutes from './support.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/posts', postRoutes);
router.use('/stories', storyRoutes);
router.use('/store', storeRoutes);
router.use('/themes', themeRoutes);
router.use('/connections', connectionRoutes);
router.use('/events', eventsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/device-tokens', deviceTokenRoutes);
router.use('/chats', chatRoutes);
router.use('/upload', uploadRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/faculties', facultiesRoutes);
router.use('/rankings', rankingsRoutes);
router.use('/subscriptions', subscriptionsRoutes);
router.use('/users', usersRoutes);
router.use('/support', supportRoutes);
router.use('/', cartRoutes); // Use cart routes (note: some routes are /cart, some /items/:itemId/save)
router.use('/', paymentRoutes); // Use payment routes (note: some routes are /webhooks, some /subscriptions, some /payments)
router.use('/', adminRoutes); // Use admin routes (note: some routes are /admin, some /reports)
router.use('/', searchRoutes); // Use search routes
router.use('/backup', backupRoutes); // Use backup routes
router.use('/offline-sync', offlineSyncRoutes); // Use offline sync routes
router.use('/rate-limits', rateLimitRoutes); // Use rate limit management routes
router.use('/moderation', moderationRoutes); // Use moderation routes

export default router;
