"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeInput = void 0;
exports.handleValidationErrors = handleValidationErrors;
exports.validateContentType = validateContentType;
exports.validateFileSize = validateFileSize;
exports.preventSQLInjection = preventSQLInjection;
exports.preventXSS = preventXSS;
exports.operationRateLimit = operationRateLimit;
exports.validateDataIntegrity = validateDataIntegrity;
const express_validator_1 = require("express-validator");
const express_validator_2 = require("express-validator");
// Global validation error handler
function handleValidationErrors(req, res, next) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map((error) => ({
            field: error.param || 'general',
            message: error.msg,
            value: error.value || undefined
        }));
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: formattedErrors
        });
    }
    next();
}
// Input sanitization middleware
exports.sanitizeInput = [
    // Sanitize string inputs
    (0, express_validator_2.sanitize)('*').trim().escape(),
    // Custom sanitization for specific fields
    (req, res, next) => {
        // Sanitize email fields
        if (req.body.email) {
            req.body.email = req.body.email.toLowerCase().trim();
        }
        // Sanitize username fields
        if (req.body.username) {
            req.body.username = req.body.username.toLowerCase().trim();
        }
        // Sanitize text content (allow some HTML for rich text)
        ['caption', 'description', 'bio', 'message'].forEach(field => {
            if (req.body[field]) {
                // Basic HTML sanitization - remove script tags and dangerous attributes
                req.body[field] = req.body[field]
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/on\w+="[^"]*"/gi, '')
                    .replace(/javascript:/gi, '');
            }
        });
        next();
    }
];
// Content security middleware
function validateContentType(allowedTypes) {
    return (req, res, next) => {
        const contentType = req.headers['content-type']?.split(';')[0];
        if (!contentType || !allowedTypes.includes(contentType)) {
            return res.status(400).json({
                success: false,
                error: `Invalid content type. Allowed: ${allowedTypes.join(', ')}`
            });
        }
        next();
    };
}
// File size validation middleware
function validateFileSize(maxSize) {
    return (req, res, next) => {
        if (req.file && req.file.size > maxSize) {
            return res.status(400).json({
                success: false,
                error: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`
            });
        }
        // Check multiple files
        if (req.files && Array.isArray(req.files)) {
            for (const file of req.files) {
                if (file.size > maxSize) {
                    return res.status(400).json({
                        success: false,
                        error: `One or more files too large. Maximum size: ${maxSize / (1024 * 1024)}MB`
                    });
                }
            }
        }
        next();
    };
}
// SQL injection prevention middleware
function preventSQLInjection(req, res, next) {
    const suspiciousPatterns = [
        /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
        /('|(\\x27)|(\\x2D\\x2D)|(\\#)|(\\x23)|(\-\-)|(\;)|(\\x3B))/i,
        /(<script|javascript:|vbscript:|onload=|onerror=)/i
    ];
    const checkValue = (value) => {
        if (typeof value === 'string') {
            return suspiciousPatterns.some(pattern => pattern.test(value));
        }
        if (typeof value === 'object' && value !== null) {
            return Object.values(value).some(checkValue);
        }
        return false;
    };
    // Check query parameters, body, and params
    const locations = [req.query, req.body, req.params];
    for (const location of locations) {
        if (checkValue(location)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid input detected'
            });
        }
    }
    next();
}
// XSS prevention middleware
function preventXSS(req, res, next) {
    const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /onload=/gi,
        /onerror=/gi,
        /onclick=/gi,
        /onmouseover=/gi
    ];
    const sanitizeValue = (value) => {
        if (typeof value === 'string') {
            let sanitized = value;
            xssPatterns.forEach(pattern => {
                sanitized = sanitized.replace(pattern, '');
            });
            return sanitized;
        }
        if (typeof value === 'object' && value !== null) {
            const sanitized = {};
            for (const [key, val] of Object.entries(value)) {
                sanitized[key] = sanitizeValue(val);
            }
            return sanitized;
        }
        return value;
    };
    // Sanitize request body
    if (req.body) {
        req.body = sanitizeValue(req.body);
    }
    next();
}
// Rate limiting for specific operations
function operationRateLimit(operations) {
    const operationCounts = {};
    return (req, res, next) => {
        const userId = req.user?.id || req.ip;
        const operation = req.route?.path || req.path;
        if (!operations[operation]) {
            return next();
        }
        const limit = operations[operation];
        const now = Date.now();
        const windowMs = 60 * 60 * 1000; // 1 hour
        if (!operationCounts[operation]) {
            operationCounts[operation] = {};
        }
        if (!operationCounts[operation][userId]) {
            operationCounts[operation][userId] = { count: 0, resetTime: now + windowMs };
        }
        const userOp = operationCounts[operation][userId];
        // Reset counter if window has passed
        if (now > userOp.resetTime) {
            userOp.count = 0;
            userOp.resetTime = now + windowMs;
        }
        if (userOp.count >= limit) {
            return res.status(429).json({
                success: false,
                error: `Operation limit exceeded for ${operation}. Try again later.`,
                retryAfter: Math.ceil((userOp.resetTime - now) / 1000)
            });
        }
        userOp.count++;
        next();
    };
}
// Data integrity validation
function validateDataIntegrity(schema) {
    return (req, res, next) => {
        const data = req.body;
        const errors = [];
        const validateField = (field, value, rules) => {
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} is required`);
                return;
            }
            if (value !== undefined && value !== null && value !== '') {
                if (rules.type && typeof value !== rules.type) {
                    errors.push(`${field} must be of type ${rules.type}`);
                }
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${field} must be at least ${rules.minLength} characters`);
                }
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`${field} must be at most ${rules.maxLength} characters`);
                }
                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`${field} format is invalid`);
                }
                if (rules.enum && !rules.enum.includes(value)) {
                    errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
                }
            }
        };
        // Validate each field in schema
        for (const [field, rules] of Object.entries(schema)) {
            validateField(field, data[field], rules);
        }
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Data validation failed',
                details: errors
            });
        }
        next();
    };
}
