import { Request, Response } from 'express';
import { pgPool } from '../config/database';
import { CONFIG } from '../config';

export const subscriptionsController = {
  // Get subscription plans
  getPlans: async (req: Request, res: Response) => {
    try {
      const plans = [
        {
          id: 'weekly',
          name: 'Weekly Premium',
          price: CONFIG.PREMIUM_WEEKLY_PRICE,
          currency: 'GHS',
          duration: '7 days',
          features: [
            'Access to rankings',
            'Premium themes',
            'Advanced analytics',
            'Priority support',
            'Ad-free experience'
          ]
        },
        {
          id: 'monthly',
          name: 'Monthly Premium',
          price: CONFIG.PREMIUM_WEEKLY_PRICE * 4 * 0.85, // 15% discount
          currency: 'GHS',
          duration: '30 days',
          features: [
            'Access to rankings',
            'Premium themes',
            'Advanced analytics',
            'Priority support',
            'Ad-free experience',
            '15% discount'
          ]
        }
      ];

      res.json({
        success: true,
        plans
      });
    } catch (error: any) {
      console.error('Get Plans Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch subscription plans'
      });
    }
  },

  // Get user subscription status
  getSubscriptionStatus: async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;

      // Get user's subscription tier
      const userResult = await pgPool.query(`
        SELECT subscription_tier, created_at
        FROM users
        WHERE id = $1
      `, [userId]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = userResult.rows[0];
      const isPremium = user.subscription_tier === 'premium';
      const isTrial = user.subscription_tier === 'trial';

      // Get active subscription if premium
      let subscription = null;
      if (isPremium) {
        const subResult = await pgPool.query(`
          SELECT id, plan_type, amount, status, starts_at, expires_at
          FROM subscriptions
          WHERE user_id = $1
            AND status = 'active'
            AND expires_at > CURRENT_TIMESTAMP
          ORDER BY expires_at DESC
          LIMIT 1
        `, [userId]);

        if (subResult.rows.length > 0) {
          subscription = {
            id: subResult.rows[0].id,
            planType: subResult.rows[0].plan_type,
            amount: parseFloat(subResult.rows[0].amount),
            status: subResult.rows[0].status,
            startsAt: subResult.rows[0].starts_at,
            expiresAt: subResult.rows[0].expires_at
          };
        }
      }

      // Calculate trial days left if on trial
      let trialDaysLeft = 0;
      if (isTrial) {
        const userCreatedAt = new Date(user.created_at);
        const trialEndDate = new Date(userCreatedAt);
        trialEndDate.setDate(trialEndDate.getDate() + CONFIG.TRIAL_PERIOD_DAYS);
        const now = new Date();
        const daysLeft = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        trialDaysLeft = Math.max(0, daysLeft);
      }

      res.json({
        success: true,
        status: user.subscription_tier,
        isPremium,
        isTrial,
        trialDaysLeft: isTrial ? trialDaysLeft : null,
        subscription
      });
    } catch (error: any) {
      console.error('Get Subscription Status Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch subscription status'
      });
    }
  }
};

