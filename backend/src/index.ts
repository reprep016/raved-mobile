import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { CONFIG } from './config';
import { connectDB, initializePostgresSchema } from './config/database';
import { createSocketServer } from './socket';
import { initializeBackgroundJobs } from './jobs/cron';
import routes from './routes';
import { PushNotificationService } from './services/push-notification.service';
import i18next from './config/i18n';
import middleware from 'i18next-http-middleware';
import { EmailService } from './services/email.service';

// Import middleware
import { apiLimiter } from './middleware/rate-limit.middleware';
import { handleValidationErrors, sanitizeInput, preventXSS, preventSQLInjection } from './middleware/validation.middleware';
import { requestLogger, errorLogger, performanceMonitor, securityLogger, apiAnalytics, healthLogger } from './middleware/logging.middleware';
import { cacheStrategies } from './middleware/cache.middleware';
import { sessionTracker, pageViewTracker, eventTracker, interactionTracker, conversionTracker } from './middleware/analytics.middleware';
import { trackDeviceStatus, handleOfflineRequests, validateOfflineRequest, trackOfflineAnalytics } from './middleware/offline.middleware';

const app = express();
const { httpServer, io } = createSocketServer(app);
export { io };

// Immediately Invoked Function Expression (IIFE) for async operations
(async () => {
  try {
    // Connect to databases and initialize schema
    await connectDB();
    await initializePostgresSchema(); // Initialize PostgreSQL schema
    initializeBackgroundJobs(); // Initialize background jobs

    // Initialize Firebase for push notifications
    PushNotificationService.initialize();

    // Initialize Email service
    EmailService.initialize();
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }

  // Middleware
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
  app.use(cors({
    origin: CONFIG.NODE_ENV === 'production'
      ? [process.env.CLIENT_URL || '', 'https://raved.app', 'https://www.raved.app']
      : true, // Allow all origins in development (needed for React Native)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Offline-Request', 'X-Device-Id']
  }));
  app.use(middleware.handle(i18next));
  app.use(compression());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Logging & Monitoring
  app.use(requestLogger);
  app.use(performanceMonitor);
  app.use(securityLogger);
  app.use(apiAnalytics);
  app.use(healthLogger);

  // Analytics Tracking
  app.use(sessionTracker);
  app.use(pageViewTracker);
  app.use(eventTracker);
  app.use(interactionTracker);
  app.use(conversionTracker);

  // Offline Support Middleware
  app.use(validateOfflineRequest);
  app.use(trackDeviceStatus);
  app.use(handleOfflineRequests);
  app.use(trackOfflineAnalytics);

  // Security Middleware
  app.use(preventXSS);
  app.use(preventSQLInjection);
  app.use(sanitizeInput);

  // Rate Limiting
  app.use(`/api/${CONFIG.API_VERSION}/`, apiLimiter);

  // Global error handler for validation
  app.use(handleValidationErrors);

  // Global Error Handler
  app.use(errorLogger);
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
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
  app.use(`/api/${CONFIG.API_VERSION}`, routes);

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
  app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });
  });

  // Start server
  const server = httpServer.listen(CONFIG.PORT, () => {
    console.log(`🚀 Server running on port ${CONFIG.PORT}`);
  });

  // Graceful shutdown on SIGTERM (not SIGINT in dev mode)
  const gracefulShutdown = async (signal: string) => {
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
  if (CONFIG.NODE_ENV === 'production') {
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }
})();
