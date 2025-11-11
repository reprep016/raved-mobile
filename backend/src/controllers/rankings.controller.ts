import { Request, Response } from 'express';
import { pgPool } from '../config/database';

export const rankingsController = {
  // Get rankings by period
  getRankings: async (req: Request, res: Response) => {
    try {
      const { period = 'weekly' } = req.query;
      const userId = req.user.id;

      // Validate period
      if (!['weekly', 'monthly', 'all-time'].includes(period as string)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid period. Must be weekly, monthly, or all-time'
        });
      }

      let scoreColumn: string;
      let orderBy: string;

      if (period === 'weekly') {
        scoreColumn = 'weekly_score';
        orderBy = 'us.weekly_score DESC';
      } else if (period === 'monthly') {
        scoreColumn = 'monthly_score';
        orderBy = 'us.monthly_score DESC';
      } else {
        scoreColumn = 'all_time_score';
        orderBy = 'us.all_time_score DESC';
      }

      // Get rankings
      const rankingsResult = await pgPool.query(`
        SELECT 
          us.user_id,
          us.${scoreColumn} as score,
          u.username,
          u.first_name,
          u.last_name,
          u.avatar_url,
          u.subscription_tier,
          us.total_likes_received,
          us.total_comments_received,
          us.total_shares_received,
          us.total_sales,
          us.total_features
        FROM user_scores us
        JOIN users u ON us.user_id = u.id
        WHERE u.subscription_tier = 'premium'
          AND u.deleted_at IS NULL
          AND us.${scoreColumn} > 0
        ORDER BY ${orderBy}
        LIMIT 100
      `);

      const rankings = rankingsResult.rows.map((row, index) => ({
        rank: index + 1,
        userId: row.user_id,
        username: row.username,
        name: `${row.first_name} ${row.last_name}`,
        avatar: row.avatar_url,
        score: parseInt(row.score) || 0,
        stats: {
          likes: parseInt(row.total_likes_received) || 0,
          comments: parseInt(row.total_comments_received) || 0,
          shares: parseInt(row.total_shares_received) || 0,
          sales: parseInt(row.total_sales) || 0,
          features: parseInt(row.total_features) || 0
        }
      }));

      // Get prize pool info
      const prizePool = period === 'weekly' 
        ? { weekly: 150.00, monthly: 600.00, allTime: 0 }
        : period === 'monthly'
        ? { weekly: 150.00, monthly: 600.00, allTime: 0 }
        : { weekly: 150.00, monthly: 600.00, allTime: 0 };

      // Get user's rank if they're in the rankings
      const userRank = rankings.findIndex(r => r.userId === userId) + 1;
      const userRanking = userRank > 0 ? rankings[userRank - 1] : null;

      res.json({
        success: true,
        period,
        prizePool,
        rankings,
        userRank: userRank > 0 ? userRank : null,
        userRanking,
        scoringSystem: {
          postLike: 10,
          postComment: 15,
          postShare: 20,
          itemSale: 50,
          weeklyFeature: 100
        }
      });
    } catch (error: any) {
      console.error('Get Rankings Error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch rankings'
      });
    }
  }
};

