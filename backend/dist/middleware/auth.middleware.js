"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.requireAdmin = exports.requirePremium = exports.authenticate = void 0;
const auth_utils_1 = require("../utils/auth.utils");
const database_1 = require("../config/database");
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'Please provide an authorization header'
            });
        }
        const token = authHeader.replace('Bearer ', '');
        if (!token || token === authHeader) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token format',
                message: 'Token must be provided as "Bearer <token>"'
            });
        }
        const decoded = (0, auth_utils_1.verifyToken)(token);
        // Support tokens that carry `userId` or `id` in payload
        const userId = decoded?.userId || decoded?.id;
        if (!decoded || !userId) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired token',
                message: 'Please log in again'
            });
        }
        // Get user from database with subscription info
        const result = await database_1.pgPool.query(`
      SELECT
        u.*,
        s.status as subscription_status,
        s.expires_at as subscription_expires_at,
        s.plan_type
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
      WHERE u.id = $1 AND u.deleted_at IS NULL
    `, [userId]);
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'User not found',
                message: 'Account may have been deleted'
            });
        }
        const user = result.rows[0];
        // Check if user is suspended
        if (user.status === 'suspended') {
            return res.status(403).json({
                success: false,
                error: 'Account suspended',
                message: 'Your account has been suspended. Please contact support.'
            });
        }
        // Attach user to request with additional computed fields
        req.user = {
            ...user,
            isPremium: user.subscription_tier === 'premium' && user.subscription_status === 'active',
            subscriptionDaysLeft: user.subscription_expires_at ?
                Math.max(0, Math.ceil((new Date(user.subscription_expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0
        };
        next();
    }
    catch (error) {
        console.error('Auth Middleware Error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication service error',
            message: 'Please try again later'
        });
    }
};
exports.authenticate = authenticate;
const requirePremium = (req, res, next) => {
    if (!req.user?.isPremium) {
        return res.status(403).json({
            success: false,
            error: 'Premium subscription required',
            message: 'This feature is only available for premium members',
            upgradeRequired: true
        });
    }
    next();
};
exports.requirePremium = requirePremium;
const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Admin access required',
            message: 'This action requires administrative privileges'
        });
    }
    next();
};
exports.requireAdmin = requireAdmin;
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            req.user = null;
            return next();
        }
        const token = authHeader.replace('Bearer ', '');
        if (!token || token === authHeader) {
            req.user = null;
            return next();
        }
        const decoded = (0, auth_utils_1.verifyToken)(token);
        const userId = decoded?.userId || decoded?.id;
        if (!decoded || !userId) {
            req.user = null;
            return next();
        }
        // Get user from database (optional auth doesn't fail on missing user)
        const result = await database_1.pgPool.query(`
      SELECT
        u.*,
        s.status as subscription_status,
        s.expires_at as subscription_expires_at,
        s.plan_type
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
      WHERE u.id = $1 AND u.deleted_at IS NULL AND u.status != 'suspended'
  `, [userId]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            req.user = {
                ...user,
                isPremium: user.subscription_tier === 'premium' && user.subscription_status === 'active',
                subscriptionDaysLeft: user.subscription_expires_at ?
                    Math.max(0, Math.ceil((new Date(user.subscription_expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0
            };
        }
        else {
            req.user = null;
        }
        next();
    }
    catch (error) {
        // For optional auth, don't fail on errors - just set user to null
        req.user = null;
        next();
    }
};
exports.optionalAuth = optionalAuth;
