"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const config_1 = require("./config");
const database_1 = require("./config/database");
const socket_1 = require("./socket");
const cron_1 = require("./jobs/cron");
const routes_1 = __importDefault(require("./routes"));
const push_notification_service_1 = require("./services/push-notification.service");
const i18n_1 = __importDefault(require("./config/i18n"));
const i18next_http_middleware_1 = __importDefault(require("i18next-http-middleware"));
const email_service_1 = require("./services/email.service");
// Import middleware
const rate_limit_middleware_1 = require("./middleware/rate-limit.middleware");
const validation_middleware_1 = require("./middleware/validation.middleware");
const logging_middleware_1 = require("./middleware/logging.middleware");
const analytics_middleware_1 = require("./middleware/analytics.middleware");
const offline_middleware_1 = require("./middleware/offline.middleware");
const app = (0, express_1.default)();
const { httpServer, io } = (0, socket_1.createSocketServer)(app);
exports.io = io;
// Immediately Invoked Function Expression (IIFE) for async operations
(async () => {
    try {
        // Connect to databases and initialize schema
        await (0, database_1.connectDB)();
        await (0, database_1.initializePostgresSchema)(); // Initialize PostgreSQL schema
        (0, cron_1.initializeBackgroundJobs)(); // Initialize background jobs
        // Initialize Firebase for push notifications
        push_notification_service_1.PushNotificationService.initialize();
        // Initialize Email service
        email_service_1.EmailService.initialize();
    }
    catch (error) {
        console.error('Failed to initialize application:', error);
        process.exit(1);
    }
    // Middleware
    app.use((0, helmet_1.default)({
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));
    app.use((0, cors_1.default)({
        origin: config_1.CONFIG.NODE_ENV === 'production'
            ? [process.env.CLIENT_URL || '', 'https://raved.app', 'https://www.raved.app']
            : true, // Allow all origins in development (needed for React Native)
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Offline-Request', 'X-Device-Id']
    }));
    app.use(i18next_http_middleware_1.default.handle(i18n_1.default));
    app.use((0, compression_1.default)());
    app.use(express_1.default.json({ limit: '50mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
    // Logging & Monitoring
    app.use(logging_middleware_1.requestLogger);
    app.use(logging_middleware_1.performanceMonitor);
    app.use(logging_middleware_1.securityLogger);
    app.use(logging_middleware_1.apiAnalytics);
    app.use(logging_middleware_1.healthLogger);
    // Analytics Tracking
    app.use(analytics_middleware_1.sessionTracker);
    app.use(analytics_middleware_1.pageViewTracker);
    app.use(analytics_middleware_1.eventTracker);
    app.use(analytics_middleware_1.interactionTracker);
    app.use(analytics_middleware_1.conversionTracker);
    // Offline Support Middleware
    app.use(offline_middleware_1.validateOfflineRequest);
    app.use(offline_middleware_1.trackDeviceStatus);
    app.use(offline_middleware_1.handleOfflineRequests);
    app.use(offline_middleware_1.trackOfflineAnalytics);
    // Security Middleware
    app.use(validation_middleware_1.preventXSS);
    app.use(validation_middleware_1.preventSQLInjection);
    app.use(validation_middleware_1.sanitizeInput);
    // Rate Limiting
    app.use(`/api/${config_1.CONFIG.API_VERSION}/`, rate_limit_middleware_1.apiLimiter);
    // Global error handler for validation
    app.use(validation_middleware_1.handleValidationErrors);
    // Global Error Handler
    app.use(logging_middleware_1.errorLogger);
    app.use((err, req, res, next) => {
        // Handle multer errors
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 10MB.'
            });
        }
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: err.errors
            });
        }
        const statusCode = err.status || 500;
        res.status(statusCode).json({
            success: false,
            error: err.message || 'Internal server error'
        });
    });
    // Routes
    app.use(`/api/${config_1.CONFIG.API_VERSION}`, routes_1.default);
    // Socket.io connection
    io.on('connection', (socket) => {
        console.log('a user connected');
        socket.on('join', (userId) => {
            console.log(`User ${userId} joined`);
            socket.join(`user:${userId}`);
        });
        socket.on('disconnect', () => {
            console.log('user disconnected');
        });
    });
    // 404 Handler (must be after all routes)
    app.use('*', (req, res) => {
        res.status(404).json({
            success: false,
            error: 'Endpoint not found'
        });
    });
    // Start server
    const server = httpServer.listen(config_1.CONFIG.PORT, () => {
        console.log(`🚀 Server running on port ${config_1.CONFIG.PORT}`);
    });
    // Graceful shutdown on SIGTERM (not SIGINT in dev mode)
    const gracefulShutdown = async (signal) => {
        console.log(`\n📋 Received ${signal}, shutting down gracefully...`);
        // Close the server (stop accepting new connections)
        server.close(() => {
            console.log('✅ HTTP server closed');
            process.exit(0);
        });
        // Force close after 10 seconds
        setTimeout(() => {
            console.error('⚠️  Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    };
    // Only handle SIGTERM in production; in dev mode, let nodemon handle restarts
    if (config_1.CONFIG.NODE_ENV === 'production') {
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    }
})();
