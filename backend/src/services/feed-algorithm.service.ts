import { pgPool } from '../config/database';
import { Post } from '../models/mongoose/post.model';
import { Like } from '../models/mongoose/like.model';
import { Comment } from '../models/mongoose/comment.model';
import mongoose from 'mongoose';

interface PostScore {
  postId: string;
  score: number;
  reasons: string[];
}

export class FeedAlgorithmService {
  /**
   * Get personalized feed with ML-like scoring
   */
  static async getPersonalizedFeed(
    userId: string,
    page: number = 1,
    limit: number = 20,
    faculty?: string
  ): Promise<{ posts: any[]; pagination: any }> {
    const skip = (page - 1) * limit;

    // Get user's connections
    const connections = await pgPool.query(
      'SELECT following_id FROM connections WHERE follower_id = $1 AND status = $2',
      [userId, 'accepted']
    );
    const followingIds = connections.rows.map(r => r.following_id);
    followingIds.push(userId); // Include own posts

    // Get user's interaction history (likes, comments, saves)
    const userLikes = await Like.find({ userId }).lean();
    const userComments = await Comment.find({ userId, deletedAt: null }).lean();
    const likedPostIds = new Set(userLikes.map(l => l.targetId));
    const commentedPostIds = new Set(userComments.map(c => c.postId?.toString()));

    // Get user's preferences (from past interactions)
    const userPreferences = await this.getUserPreferences(userId);

    // Get all posts from connections and faculty
    const allPosts = await Post.find({
      userId: { $in: followingIds },
      deletedAt: null,
      $or: [
        { visibility: 'public' },
        { visibility: 'connections', userId: { $in: followingIds } },
        { visibility: 'faculty', faculty }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(limit * 3) // Get more posts to score
      .lean();

    // Score each post
    const scoredPosts: PostScore[] = allPosts.map(post => {
      let score = 0;
      const reasons: string[] = [];

      // Base score from recency (newer posts get higher base score)
      const hoursSinceCreation = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
      const recencyScore = Math.max(0, 100 - hoursSinceCreation * 2);
      score += recencyScore * 0.3;
      if (hoursSinceCreation < 24) reasons.push('Recent');

      // Engagement score (likes, comments, shares)
      const engagementScore = (post.likesCount || 0) * 2 + (post.commentsCount || 0) * 3 + (post.sharesCount || 0) * 5;
      score += Math.min(engagementScore, 200) * 0.25;
      if (engagementScore > 50) reasons.push('High engagement');

      // Connection strength (close connections get higher score)
      const isDirectConnection = followingIds.includes(post.userId);
      if (isDirectConnection) {
        score += 50;
        reasons.push('From connection');
      }

      // Faculty match
      if (post.faculty === faculty) {
        score += 30;
        reasons.push('Same faculty');
      }

      // User interaction history (boost posts similar to what user liked)
      if (likedPostIds.has(post._id.toString())) {
        score += 100; // Already liked
        reasons.push('You liked this');
      }

      // Tag preferences (if user likes posts with certain tags)
      if (post.tags && post.tags.length > 0) {
        const matchingTags = post.tags.filter(tag => userPreferences.preferredTags.includes(tag));
        score += matchingTags.length * 20;
        if (matchingTags.length > 0) reasons.push(`Tags: ${matchingTags.join(', ')}`);
      }

      // Media type preference
      if (userPreferences.preferredMediaTypes.includes(post.type)) {
        score += 25;
        reasons.push('Preferred media type');
      }

      // Time-based boost (posts from active hours get slight boost)
      const postHour = new Date(post.createdAt).getHours();
      if (postHour >= 8 && postHour <= 22) {
        score += 10;
      }

      return {
        postId: post._id.toString(),
        score,
        reasons
      };
    });

    // Sort by score and take top posts
    scoredPosts.sort((a, b) => b.score - a.score);
    const topPostIds = scoredPosts.slice(0, limit).map(p => new mongoose.Types.ObjectId(p.postId));

    // Fetch full post data
    const topPosts = await Post.find({
      _id: { $in: topPostIds }
    })
      .sort({ createdAt: -1 })
      .lean();

    // Reorder to match scoring order
    const orderedPosts = topPostIds.map(id => 
      topPosts.find(p => p._id.toString() === id.toString())
    ).filter(Boolean);

    return {
      posts: orderedPosts,
      pagination: {
        page,
        limit,
        hasMore: allPosts.length > limit
      }
    };
  }

  /**
   * Get trending posts
   */
  static async getTrendingPosts(
    userId: string,
    page: number = 1,
    limit: number = 20,
    timeWindow: '24h' | '7d' | '30d' = '24h'
  ): Promise<{ posts: any[]; pagination: any }> {
    const skip = (page - 1) * limit;
    const now = new Date();
    let timeThreshold: Date;

    switch (timeWindow) {
      case '24h':
        timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        timeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        timeThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get posts from time window
    const posts = await Post.find({
      createdAt: { $gte: timeThreshold },
      deletedAt: null,
      $or: [
        { visibility: 'public' },
        { visibility: 'faculty' }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(limit * 3)
      .lean();

    // Calculate trending score for each post
    const scoredPosts: PostScore[] = posts.map(post => {
      let score = 0;

      // Engagement velocity (recent engagement weighted more)
      const hoursSinceCreation = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
      const engagementVelocity = ((post.likesCount || 0) + (post.commentsCount || 0) * 2) / Math.max(1, hoursSinceCreation);
      score += engagementVelocity * 50;

      // Total engagement
      const totalEngagement = (post.likesCount || 0) * 1 + (post.commentsCount || 0) * 3 + (post.sharesCount || 0) * 5;
      score += totalEngagement * 2;

      // Recency boost (very recent posts get boost)
      if (hoursSinceCreation < 6) {
        score += 100;
      } else if (hoursSinceCreation < 24) {
        score += 50;
      }

      // Views to engagement ratio (high engagement rate = trending)
      const viewsCount = post.viewsCount || 1;
      const engagementRate = totalEngagement / viewsCount;
      score += engagementRate * 200;

      return {
        postId: post._id.toString(),
        score,
        reasons: ['Trending']
      };
    });

    // Sort by score
    scoredPosts.sort((a, b) => b.score - a.score);
    const topPostIds = scoredPosts.slice(0, limit).map(p => new mongoose.Types.ObjectId(p.postId));

    // Fetch full post data
    const topPosts = await Post.find({
      _id: { $in: topPostIds }
    })
      .sort({ createdAt: -1 })
      .lean();

    // Reorder to match scoring order
    const orderedPosts = topPostIds.map(id => 
      topPosts.find(p => p._id.toString() === id.toString())
    ).filter(Boolean);

    return {
      posts: orderedPosts,
      pagination: {
        page,
        limit,
        hasMore: posts.length > limit
      }
    };
  }

  /**
   * Get post suggestions (posts user might like)
   */
  static async getPostSuggestions(
    userId: string,
    limit: number = 10
  ): Promise<any[]> {
    // Get user's interaction history
    const userLikes = await Like.find({ userId }).lean();
    const userComments = await Comment.find({ userId, deletedAt: null }).lean();
    const likedPostIds = new Set(userLikes.map(l => l.targetId));
    const commentedPostIds = new Set(userComments.map(c => c.postId?.toString()));

    // Get user's connections
    const connections = await pgPool.query(
      'SELECT following_id FROM connections WHERE follower_id = $1 AND status = $2',
      [userId, 'accepted']
    );
    const followingIds = connections.rows.map(r => r.following_id);

    // Get user info
    const userResult = await pgPool.query(
      'SELECT faculty FROM users WHERE id = $1',
      [userId]
    );
    const userFaculty = userResult.rows[0]?.faculty;

    // Get posts from similar users (same faculty, not already liked)
    const suggestedPosts = await Post.find({
      _id: { $nin: Array.from(likedPostIds).map(id => new mongoose.Types.ObjectId(id)) },
      userId: { $nin: [userId, ...followingIds] },
      deletedAt: null,
      visibility: { $in: ['public', 'faculty'] },
      ...(userFaculty ? { faculty: userFaculty } : {})
    })
      .sort({ 
        likesCount: -1,
        commentsCount: -1,
        createdAt: -1 
      })
      .limit(limit * 2)
      .lean();

    // Score suggestions
    const scoredSuggestions: PostScore[] = suggestedPosts.map(post => {
      let score = 0;

      // Faculty match
      if (post.faculty === userFaculty) {
        score += 50;
      }

      // High engagement
      const engagement = (post.likesCount || 0) + (post.commentsCount || 0) * 2;
      score += Math.min(engagement, 100);

      // Recency
      const hoursSinceCreation = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceCreation < 48) {
        score += 30;
      }

      return {
        postId: post._id.toString(),
        score,
        reasons: ['Suggested for you']
      };
    });

    // Sort and return top suggestions
    scoredSuggestions.sort((a, b) => b.score - a.score);
    const topSuggestionIds = scoredSuggestions.slice(0, limit).map(p => new mongoose.Types.ObjectId(p.postId));

    const topSuggestions = await Post.find({
      _id: { $in: topSuggestionIds }
    })
      .lean();

    return topSuggestionIds.map(id => 
      topSuggestions.find(p => p._id.toString() === id.toString())
    ).filter(Boolean);
  }

  /**
   * Get user preferences from interaction history
   */
  private static async getUserPreferences(userId: string): Promise<{
    preferredTags: string[];
    preferredMediaTypes: string[];
  }> {
    const userLikes = await Like.find({ userId, targetType: 'post' }).lean();
    const likedPostIds = userLikes.map(l => l.targetId);

    if (likedPostIds.length === 0) {
      return { preferredTags: [], preferredMediaTypes: ['image', 'video', 'carousel'] };
    }

    const likedPosts = await Post.find({
      _id: { $in: likedPostIds.map(id => new mongoose.Types.ObjectId(id)) }
    }).lean();

    // Extract preferred tags
    const tagCounts: Record<string, number> = {};
    likedPosts.forEach(post => {
      if (post.tags) {
        post.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    const preferredTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    // Extract preferred media types
    const mediaTypeCounts: Record<string, number> = {};
    likedPosts.forEach(post => {
      mediaTypeCounts[post.type] = (mediaTypeCounts[post.type] || 0) + 1;
    });

    const preferredMediaTypes = Object.entries(mediaTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);

    return {
      preferredTags: preferredTags.length > 0 ? preferredTags : [],
      preferredMediaTypes: preferredMediaTypes.length > 0 ? preferredMediaTypes : ['image', 'video', 'carousel']
    };
  }
}

