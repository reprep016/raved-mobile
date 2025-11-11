"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.requestLogger = requestLogger;
exports.errorLogger = errorLogger;
exports.performanceMonitor = performanceMonitor;
exports.securityLogger = securityLogger;
exports.apiAnalytics = apiAnalytics;
exports.healthLogger = healthLogger;
const fs_1 = require("fs");
const path_1 = require("path");
const config_1 = require("../config");
// Create logs directory if it doesn't exist
const fs_2 = require("fs");
try {
    (0, fs_2.mkdirSync)('logs', { recursive: true });
}
catch (error) {
    // Directory already exists
}
// Create log stream
const logStream = (0, fs_1.createWriteStream)((0, path_1.join)(config_1.CONFIG.LOG_FILE), { flags: 'a' });
class Logger {
    log(entry) {
        const logLine = JSON.stringify(entry) + '\n';
        // Console logging
        if (config_1.CONFIG.LOG_LEVEL === 'info' ||
            (config_1.CONFIG.LOG_LEVEL === 'warn' && entry.level !== 'info') ||
            (config_1.CONFIG.LOG_LEVEL === 'error' && entry.level === 'error')) {
            console.log(`[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.method} ${entry.url} ${entry.statusCode || ''} ${entry.responseTime ? `(${entry.responseTime}ms)` : ''}`);
        }
        // File logging
        logStream.write(logLine);
    }
    info(message, data) {
        this.log({
            timestamp: new Date().toISOString(),
            level: 'info',
            ...data
        });
    }
    warn(message, data) {
        this.log({
            timestamp: new Date().toISOString(),
            level: 'warn',
            ...data
        });
    }
    error(message, error, data) {
        this.log({
            timestamp: new Date().toISOString(),
            level: 'error',
            message,
            error: error?.message || error,
            ...data
        });
    }
}
exports.logger = new Logger();
// Request logging middleware
function requestLogger(req, res, next) {
    const startTime = Date.now();
    const userId = req.user?.id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    // Log request
    exports.logger.info('Request received', {
        method: req.method,
        url: req.originalUrl,
        userId,
        ip,
        userAgent
    });
    // Log response when request finishes
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        exports.logger.info('Request completed', {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTime: duration,
            userId,
            ip,
            userAgent
        });
    });
    next();
}
// Error logging middleware
function errorLogger(error, req, res, next) {
    const userId = req.user?.id;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    exports.logger.error('Request error', error, {
        method: req.method,
        url: req.originalUrl,
        userId,
        ip,
        statusCode: res.statusCode
    });
    next(error);
}
// Performance monitoring middleware
function performanceMonitor(req, res, next) {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        const memoryDelta = {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal
        };
        // Log slow requests (>500ms)
        if (duration > 500) {
            exports.logger.warn('Slow request detected', {
                method: req.method,
                url: req.originalUrl,
                duration: Math.round(duration),
                memoryDelta,
                userId: req.user?.id
            });
        }
        // Log high memory usage requests
        if (memoryDelta.heapUsed > 10 * 1024 * 1024) { // 10MB
            exports.logger.warn('High memory usage request', {
                method: req.method,
                url: req.originalUrl,
                duration: Math.round(duration),
                memoryDelta,
                userId: req.user?.id
            });
        }
    });
    next();
}
// Security event logging
function securityLogger(req, res, next) {
    // Log suspicious activities
    const suspiciousPatterns = [
        /\bUNION\b|\bSELECT\b|\bDROP\b|\bDELETE\b/i,
        /<script/i,
        /\.\./, // Directory traversal
        /etc\/passwd/i
    ];
    const checkForSuspicious = (value) => {
        if (typeof value === 'string') {
            return suspiciousPatterns.some(pattern => pattern.test(value));
        }
        if (typeof value === 'object' && value !== null) {
            return Object.values(value).some(checkForSuspicious);
        }
        return false;
    };
    if (checkForSuspicious(req.query) || checkForSuspicious(req.body)) {
        exports.logger.warn('Suspicious request detected', {
            method: req.method,
            url: req.originalUrl,
            query: req.query,
            body: req.body,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id
        });
    }
    next();
}
// API usage analytics
function apiAnalytics(req, res, next) {
    res.on('finish', () => {
        // Log API usage for analytics
        exports.logger.info('API usage', {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            userId: req.user?.id,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });
    });
    next();
}
// Health check endpoint logger
function healthLogger(req, res, next) {
    if (req.path === '/health') {
        exports.logger.info('Health check', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        });
    }
    next();
}
