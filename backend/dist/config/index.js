"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.CONFIG = {
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    API_BASE_URL: process.env.API_BASE_URL || 'https://api.raved.app',
    API_VERSION: 'v1',
    JWT_SECRET: process.env.JWT_SECRET || 'raved-super-secret-key-change-in-production',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'raved-refresh-secret',
    JWT_EXPIRES_IN: '24h',
    JWT_REFRESH_EXPIRES_IN: '7d',
    // Database URLs
    POSTGRES_URL: process.env.POSTGRES_URL || 'postgresql://localhost:5432/raved_app',
    MONGODB_URL: process.env.MONGODB_URL || 'mongodb://localhost:27017/raved_app',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    // File Upload
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm'],
    // Payment (Paystack)
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY,
    // Communications
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    // Subscription Pricing (in Ghana Cedis)
    PREMIUM_WEEKLY_PRICE: 5.00,
    TRIAL_PERIOD_DAYS: 7,
    // Rankings & Gamification
    POINTS: {
        POST_LIKE: 10,
        POST_COMMENT: 15,
        POST_SHARE: 20,
        ITEM_SALE: 50,
        WEEKLY_FEATURE: 100
    },
    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    // Cache Configuration
    CACHE_TTL: parseInt(process.env.CACHE_TTL || '3600'), // 1 hour
    REDIS_CACHE_PREFIX: process.env.REDIS_CACHE_PREFIX || 'raved:',
    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_FILE: process.env.LOG_FILE || 'logs/app.log'
};
