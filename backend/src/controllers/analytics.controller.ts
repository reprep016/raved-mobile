import { Request, Response } from 'express';
import { pgPool } from '../config/database';
import { Post } from '../models/mongoose/post.model';
import { Like } from '../models/mongoose/like.model';
import { Comment } from '../models/mongoose/comment.model';
import mongoose from 'mongoose';

export const analyticsController = {
  // Get user analytics
  getUserAnalytics: async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const { period = '30d' } = req.query;

      let dateThreshold: Date;
      const now = new Date();
      
      switch (period) {
        case '7d':
          dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          dateThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get post analytics from MongoDB
      const posts = await Post.find({
        userId,
        createdAt: { $gte: dateThreshold },
        deletedAt: null
      }).lean();

      const postStats = {
        total_posts: posts.length,
        total_likes: posts.reduce((sum, p) => sum + (p.likesCount || 0), 0),
        total_comments: posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0),
        total_shares: posts.reduce((sum, p) => sum + (p.sharesCount || 0), 0),
        total_views: posts.reduce((sum, p) => sum + (p.viewsCount || 0), 0),
        avg_likes_per_post: posts.length > 0 
          ? posts.reduce((sum, p) => sum + (p.likesCount || 0), 0) / posts.length 
          : 0,
        avg_comments_per_post: posts.length > 0
          ? posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0) / posts.length
          : 0
      };

      // Get follower growth
      const followerGrowth = await pgPool.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as new_followers
        FROM connections
        WHERE following_id = $1 
          AND status = 'accepted'
          AND created_at >= $2
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [userId, dateThreshold]);

      // Get engagement rate
      const engagementRate = postStats.total_views > 0
        ? ((postStats.total_likes + postStats.total_comments) / postStats.total_views) * 100
        : 0;

      // Get best performing posts from MongoDB
      const bestPosts = await Post.find({
        userId,
        createdAt: { $gte: dateThreshold },
        deletedAt: null
      })
        .sort({ 
          likesCount: -1,
          commentsCount: -1,
          sharesCount: -1
        })
        .limit(5)
        .lean();

      // Get audience demographics (faculty distribution of followers)
      const audienceDemographics = await pgPool.query(`
        SELECT 
          u.faculty,
          COUNT(*) as count
        FROM connections c
        JOIN users u ON c.follower_id = u.id
        WHERE c.following_id = $1 
          AND c.status = 'accepted'
        GROUP BY u.faculty
        ORDER BY count DESC
      `, [userId]);

      res.json({
        success: true,
        analytics: {
          period,
          posts: {
            total: postStats.total_posts,
            totalLikes: postStats.total_likes,
            totalComments: postStats.total_comments,
            totalShares: postStats.total_shares,
            totalViews: postStats.total_views,
            avgLikesPerPost: parseFloat(postStats.avg_likes_per_post.toFixed(2)),
            avgCommentsPerPost: parseFloat(postStats.avg_comments_per_post.toFixed(2)),
            engagementRate: parseFloat(engagementRate.toFixed(2))
          },
          followers: {
            growth: followerGrowth.rows.map(row => ({
              date: row.date,
              count: parseInt(row.new_followers)
            }))
          },
          bestPosts: bestPosts.map(post => ({
            id: post._id.toString(),
            caption: post.caption?.substring(0, 50) || '',
            likes: post.likesCount || 0,
            comments: post.commentsCount || 0,
            shares: post.sharesCount || 0,
            views: post.viewsCount || 0,
            createdAt: post.createdAt
          })),
          audience: {
            demographics: audienceDemographics.rows.map(demo => ({
              faculty: demo.faculty || 'Unknown',
              count: parseInt(demo.count)
            }))
          }
        }
      });
    } catch (error) {
      console.error('Get User Analytics Error:', error);
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  },

  // Track analytics event
  trackEvent: async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const {
        eventType,
        eventCategory,
        eventAction,
        eventLabel,
        eventValue,
        metadata
      } = req.body;

      const sessionId = req.headers['x-session-id'] as string || `session_${Date.now()}`;

      await pgPool.query(`
        INSERT INTO analytics_events (
          user_id, session_id, event_type, event_category, event_action,
          event_label, event_value, metadata, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      `, [
        userId,
        sessionId,
        eventType || 'user_action',
        eventCategory || 'general',
        eventAction || 'click',
        eventLabel,
        eventValue,
        metadata ? JSON.stringify(metadata) : '{}'
      ]);

      res.json({ success: true });
    } catch (error) {
      console.error('Track Event Error:', error);
      res.status(500).json({ error: 'Failed to track event' });
    }
  },

  // Get store analytics (for sellers)
  getStoreAnalytics: async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const { period = '30d' } = req.query;

      let dateThreshold: Date;
      const now = new Date();
      
      switch (period) {
        case '7d':
          dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          dateThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Get store item stats
      const storeStats = await pgPool.query(`
        SELECT 
          COUNT(*) as total_items,
          SUM(views_count) as total_views,
          SUM(likes_count) as total_likes,
          SUM(saves_count) as total_saves,
          SUM(sales_count) as total_sales,
          SUM(price * sales_count) as total_revenue,
          AVG(views_count) as avg_views_per_item,
          AVG(likes_count) as avg_likes_per_item
        FROM store_items
        WHERE seller_id = $1 
          AND created_at >= $2
          AND deleted_at IS NULL
      `, [userId, dateThreshold]);

      // Get top selling items
      const topItems = await pgPool.query(`
        SELECT 
          id,
          name,
          price,
          sales_count,
          views_count,
          likes_count,
          created_at
        FROM store_items
        WHERE seller_id = $1 
          AND created_at >= $2
          AND deleted_at IS NULL
        ORDER BY sales_count DESC, views_count DESC
        LIMIT 5
      `, [userId, dateThreshold]);

      // Get sales over time
      const salesOverTime = await pgPool.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as items_sold,
          SUM(price * sales_count) as revenue
        FROM store_items
        WHERE seller_id = $1 
          AND created_at >= $2
          AND sales_count > 0
          AND deleted_at IS NULL
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [userId, dateThreshold]);

      res.json({
        success: true,
        analytics: {
          period,
          items: {
            total: parseInt(storeStats.rows[0].total_items || 0),
            totalViews: parseInt(storeStats.rows[0].total_views || 0),
            totalLikes: parseInt(storeStats.rows[0].total_likes || 0),
            totalSaves: parseInt(storeStats.rows[0].total_saves || 0),
            avgViewsPerItem: parseFloat(storeStats.rows[0].avg_views_per_item || 0),
            avgLikesPerItem: parseFloat(storeStats.rows[0].avg_likes_per_item || 0)
          },
          sales: {
            total: parseInt(storeStats.rows[0].total_sales || 0),
            totalRevenue: parseFloat(storeStats.rows[0].total_revenue || 0)
          },
          topItems: topItems.rows.map(item => ({
            id: item.id,
            name: item.name,
            price: parseFloat(item.price),
            sales: parseInt(item.sales_count || 0),
            views: parseInt(item.views_count || 0),
            likes: parseInt(item.likes_count || 0),
            createdAt: item.created_at
          })),
          salesOverTime: salesOverTime.rows.map(row => ({
            date: row.date,
            itemsSold: parseInt(row.items_sold || 0),
            revenue: parseFloat(row.revenue || 0)
          }))
        }
      });
    } catch (error) {
      console.error('Get Store Analytics Error:', error);
      res.status(500).json({ error: 'Failed to get store analytics' });
    }
  },

  // Admin-only analytics methods
  getDashboardOverview: async (req: Request, res: Response) => {
    try {
      // Get overall platform statistics
      const userCount = await pgPool.query('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL');
      const postCount = await Post.countDocuments({ deletedAt: null });
      const activeUsers = await pgPool.query(`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM analytics_events 
        WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `);

      res.json({
        success: true,
        dashboard: {
          totalUsers: parseInt(userCount.rows[0].count),
          totalPosts: postCount,
          activeUsers24h: parseInt(activeUsers.rows[0].count || 0),
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Get Dashboard Overview Error:', error);
      res.status(500).json({ error: 'Failed to get dashboard overview' });
    }
  },

  getRealtimeMetrics: async (req: Request, res: Response) => {
    try {
      // Get real-time metrics (last hour)
      const lastHour = new Date(Date.now() - 60 * 60 * 1000);
      
      const metrics = await pgPool.query(`
        SELECT 
          COUNT(DISTINCT user_id) as active_users,
          COUNT(*) as events_count
        FROM analytics_events
        WHERE timestamp >= $1
      `, [lastHour]);

      res.json({
        success: true,
        metrics: {
          activeUsers: parseInt(metrics.rows[0].active_users || 0),
          eventsCount: parseInt(metrics.rows[0].events_count || 0),
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Get Realtime Metrics Error:', error);
      res.status(500).json({ error: 'Failed to get realtime metrics' });
    }
  },

  getUserActivityHistory: async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const activities = await pgPool.query(`
        SELECT 
          event_type,
          event_category,
          event_action,
          event_label,
          timestamp
        FROM analytics_events
        WHERE user_id = $1
        ORDER BY timestamp DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);

      res.json({
        success: true,
        activities: activities.rows,
        pagination: {
          page,
          limit,
          hasMore: activities.rows.length === limit
        }
      });
    } catch (error) {
      console.error('Get User Activity History Error:', error);
      res.status(500).json({ error: 'Failed to get user activity history' });
    }
  },

  generateReport: async (req: Request, res: Response) => {
    try {
      const { reportType, startDate, endDate } = req.body;
      
      // Placeholder for report generation
      res.json({
        success: true,
        message: 'Report generation feature coming soon',
        reportType,
        startDate,
        endDate
      });
    } catch (error) {
      console.error('Generate Report Error:', error);
      res.status(500).json({ error: 'Failed to generate report' });
    }
  },

  getReports: async (req: Request, res: Response) => {
    try {
      // Placeholder for getting reports list
      res.json({
        success: true,
        reports: []
      });
    } catch (error) {
      console.error('Get Reports Error:', error);
      res.status(500).json({ error: 'Failed to get reports' });
    }
  },

  createABTest: async (req: Request, res: Response) => {
    try {
      const { testName, variants } = req.body;
      
      // Placeholder for A/B test creation
      res.json({
        success: true,
        message: 'A/B test creation feature coming soon',
        testName,
        variants
      });
    } catch (error) {
      console.error('Create AB Test Error:', error);
      res.status(500).json({ error: 'Failed to create A/B test' });
    }
  },

  getABTestVariant: async (req: Request, res: Response) => {
    try {
      const { testName } = req.params;
      
      // Placeholder for getting A/B test variant
      res.json({
        success: true,
        testName,
        variant: 'control'
      });
    } catch (error) {
      console.error('Get AB Test Variant Error:', error);
      res.status(500).json({ error: 'Failed to get A/B test variant' });
    }
  },

  trackABTestResult: async (req: Request, res: Response) => {
    try {
      const { testName } = req.params;
      const { variant, result } = req.body;
      
      // Placeholder for tracking A/B test results
      res.json({
        success: true,
        message: 'A/B test result tracked',
        testName,
        variant,
        result
      });
    } catch (error) {
      console.error('Track AB Test Result Error:', error);
      res.status(500).json({ error: 'Failed to track A/B test result' });
    }
  },

  getABTestResults: async (req: Request, res: Response) => {
    try {
      const { testName } = req.params;
      
      // Placeholder for getting A/B test results
      res.json({
        success: true,
        testName,
        results: {
          control: { conversions: 0, visitors: 0 },
          variant: { conversions: 0, visitors: 0 }
        }
      });
    } catch (error) {
      console.error('Get AB Test Results Error:', error);
      res.status(500).json({ error: 'Failed to get A/B test results' });
    }
  },

  runCustomQuery: async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      
      // Placeholder for custom query execution
      res.json({
        success: true,
        message: 'Custom query feature coming soon',
        query
      });
    } catch (error) {
      console.error('Run Custom Query Error:', error);
      res.status(500).json({ error: 'Failed to run custom query' });
    }
  },

  exportAnalyticsData: async (req: Request, res: Response) => {
    try {
      const { format = 'json', startDate, endDate } = req.query;
      
      // Placeholder for data export
      res.json({
        success: true,
        message: 'Data export feature coming soon',
        format,
        startDate,
        endDate
      });
    } catch (error) {
      console.error('Export Analytics Data Error:', error);
      res.status(500).json({ error: 'Failed to export analytics data' });
    }
  }
};
