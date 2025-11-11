"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const posts_routes_1 = __importDefault(require("./posts.routes"));
const stories_routes_1 = __importDefault(require("./stories.routes"));
const store_routes_1 = __importDefault(require("./store.routes"));
const theme_routes_1 = __importDefault(require("./theme.routes"));
const connection_routes_1 = __importDefault(require("./connection.routes"));
const cart_routes_1 = __importDefault(require("./cart.routes"));
const payment_routes_1 = __importDefault(require("./payment.routes"));
const admin_routes_1 = __importDefault(require("./admin.routes"));
const search_routes_1 = __importDefault(require("./search.routes"));
const events_routes_1 = __importDefault(require("./events.routes"));
const notifications_routes_1 = __importDefault(require("./notifications.routes"));
const device_token_routes_1 = __importDefault(require("./device-token.routes"));
const chat_routes_1 = __importDefault(require("./chat.routes"));
const upload_routes_1 = __importDefault(require("./upload.routes"));
const analytics_routes_1 = __importDefault(require("./analytics.routes"));
const backup_routes_1 = __importDefault(require("./backup.routes"));
const rate_limit_routes_1 = __importDefault(require("./rate-limit.routes"));
const offline_sync_routes_1 = __importDefault(require("./offline-sync.routes"));
const moderation_routes_1 = __importDefault(require("./moderation.routes"));
const faculties_routes_1 = __importDefault(require("./faculties.routes"));
const rankings_routes_1 = __importDefault(require("./rankings.routes"));
const subscriptions_routes_1 = __importDefault(require("./subscriptions.routes"));
const users_routes_1 = __importDefault(require("./users.routes"));
const router = (0, express_1.Router)();
router.use('/auth', auth_routes_1.default);
router.use('/posts', posts_routes_1.default);
router.use('/stories', stories_routes_1.default);
router.use('/store', store_routes_1.default);
router.use('/themes', theme_routes_1.default);
router.use('/connections', connection_routes_1.default);
router.use('/events', events_routes_1.default);
router.use('/notifications', notifications_routes_1.default);
router.use('/device-tokens', device_token_routes_1.default);
router.use('/chats', chat_routes_1.default);
router.use('/upload', upload_routes_1.default);
router.use('/analytics', analytics_routes_1.default);
router.use('/faculties', faculties_routes_1.default);
router.use('/rankings', rankings_routes_1.default);
router.use('/subscriptions', subscriptions_routes_1.default);
router.use('/users', users_routes_1.default);
router.use('/', cart_routes_1.default); // Use cart routes (note: some routes are /cart, some /items/:itemId/save)
router.use('/', payment_routes_1.default); // Use payment routes (note: some routes are /webhooks, some /subscriptions, some /payments)
router.use('/', admin_routes_1.default); // Use admin routes (note: some routes are /admin, some /reports)
router.use('/', search_routes_1.default); // Use search routes
router.use('/backup', backup_routes_1.default); // Use backup routes
router.use('/offline-sync', offline_sync_routes_1.default); // Use offline sync routes
router.use('/rate-limits', rate_limit_routes_1.default); // Use rate limit management routes
router.use('/moderation', moderation_routes_1.default); // Use moderation routes
exports.default = router;
