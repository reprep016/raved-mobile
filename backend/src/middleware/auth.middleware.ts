import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth.utils';
import { pgPool } from '../config/database';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
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

    const decoded: any = verifyToken(token);
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
    const result = await pgPool.query(`
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
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication service error',
      message: 'Please try again later'
    });
  }
};

export const requirePremium = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user has premium subscription
    if (req.user?.subscription_tier === 'premium' && req.user?.subscription_status === 'active') {
      // Check if subscription is expired
      if (req.user?.subscription_expires_at) {
        const expiresAt = new Date(req.user.subscription_expires_at);
        if (expiresAt < new Date()) {
          // Subscription expired, update user status
          await pgPool.query(
            'UPDATE users SET subscription_tier = $1 WHERE id = $2',
            ['free', req.user.id]
          );
          return res.status(403).json({
            success: false,
            error: 'Premium subscription expired',
            message: 'Your premium subscription has expired. Please renew to continue using premium features.',
            upgradeRequired: true,
            expired: true
          });
        }
      }
      return next();
    }

    // Check if user is on trial
    if (req.user?.subscription_tier === 'trial' || req.user?.trial_started_at) {
      const trialStart = new Date(req.user.trial_started_at || req.user.created_at);
      const trialDays = 7; // 7-day trial
      const trialEnd = new Date(trialStart.getTime() + trialDays * 24 * 60 * 60 * 1000);
      
      if (new Date() > trialEnd) {
        // Trial expired
        await pgPool.query(
          'UPDATE users SET subscription_tier = $1 WHERE id = $2',
          ['free', req.user.id]
        );
        return res.status(403).json({
          success: false,
          error: 'Trial period expired',
          message: 'Your free trial has ended. Upgrade to premium to continue using this feature.',
          upgradeRequired: true,
          trialExpired: true
        });
      }
      
      // Still on trial, allow access
      return next();
    }

    // Not premium and not on trial
    return res.status(403).json({
      success: false,
      error: 'Premium subscription required',
      message: 'This feature is only available for premium members. Start your free trial or upgrade now.',
      upgradeRequired: true
    });
  } catch (error) {
    console.error('Require Premium Middleware Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Premium check failed',
      message: 'Please try again later'
    });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      message: 'This action requires administrative privileges'
    });
  }
  next();
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
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

    const decoded: any = verifyToken(token);
    const userId = decoded?.userId || decoded?.id;
    if (!decoded || !userId) {
      req.user = null;
      return next();
    }

    // Get user from database (optional auth doesn't fail on missing user)
    const result = await pgPool.query(`
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
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // For optional auth, don't fail on errors - just set user to null
    req.user = null;
    next();
  }
};
