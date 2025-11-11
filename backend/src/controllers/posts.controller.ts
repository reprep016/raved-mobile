import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { Post, Comment, Like } from '../models/mongoose';
import { pgPool } from '../config/database';
import { getTimeAgo } from '../utils';
import OfflineDataService from '../services/offline-data.service';
import DataVersioningService from '../services/data-versioning.service';
import SelectiveCacheService from '../services/selective-cache.service';
import OfflineAnalyticsService from '../services/offline-analytics.service';

export const createPost = async (req: Request, res: Response) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.user.id;
        const {
            type,
            caption,
            media,
            location,
            tags,
            brand,
            occasion,
            visibility,
            isForSale,
            saleDetails,
            offline = false // Check if this is an offline operation
        } = req.body;
        
        // Prepare post data
        const postData = {
            userId,
            type,
            caption,
            media,
            location,
            tags: tags || [],
            brand,
            occasion,
            visibility: visibility || 'public',
            isForSale: isForSale || false,
            saleDetails: isForSale ? {
                itemName: saleDetails.itemName,
                price: saleDetails.price,
                originalPrice: saleDetails.originalPrice,
                category: saleDetails.category,
                condition: saleDetails.condition,
                size: saleDetails.size,
                brand: saleDetails.brand,
                color: saleDetails.color,
                material: saleDetails.material,
                paymentMethods: saleDetails.paymentMethods || ['momo'],
                meetupLocation: saleDetails.meetupLocation,
                sellerPhone: saleDetails.sellerPhone,
                negotiable: saleDetails.negotiable || false
            } : null,
            faculty: req.user.faculty
        };

        if (offline) {
            // Store for offline processing
            const offlineEntity = {
                entityType: 'post',
                entityId: `temp_${Date.now()}_${Math.random()}`,
                data: postData,
                metadata: {
                    operation: 'create',
                    offline: true,
                    createdAt: new Date(),
                    deviceId: req.headers['x-device-id'] as string,
                },
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                priority: 1,
                tags: ['post', 'create', 'offline'],
            };

            const storedData = await OfflineDataService.storeOfflineData(userId, offlineEntity);

            // Track offline analytics
            await OfflineAnalyticsService.queueAnalyticsEvent({
                userId,
                sessionId: req.headers['x-session-id'] as string || `offline_${Date.now()}`,
                eventType: 'offline_post_create',
                eventCategory: 'offline_actions',
                eventAction: 'queued',
                timestamp: new Date(),
                offline: true,
                metadata: {
                    entityType: 'post',
                },
            });

            return res.json({
                success: true,
                message: 'Post queued for offline creation',
                offline: true,
                offlineId: storedData.id,
                post: {
                    id: offlineEntity.entityId,
                    ...postData,
                    offline: true,
                }
            });
        }

        // Handle sale post creation
        if (isForSale && saleDetails) {
            // Create sale post in MongoDB
            const salePost = new Post(postData);

            await salePost.save();

            // Update user's post count in PostgreSQL
            await pgPool.query(
                'UPDATE users SET posts_count = posts_count + 1 WHERE id = $1',
                [userId]
            );

            // Create store item entry for marketplace
            await pgPool.query(`
                INSERT INTO store_items (
                    seller_id, name, description, price, original_price,
                    category, condition, size, brand, color, material,
                    images, payment_methods, meetup_location, seller_phone,
                    status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
            `, [
                userId,
                saleDetails.itemName,
                caption || '',
                saleDetails.price,
                saleDetails.originalPrice || null,
                saleDetails.category,
                saleDetails.condition,
                saleDetails.size || null,
                saleDetails.brand || null,
                saleDetails.color || null,
                saleDetails.material || null,
                media || [],
                saleDetails.paymentMethods || ['momo'],
                saleDetails.meetupLocation || null,
                saleDetails.sellerPhone || null,
                'active'
            ]);

            // Create version record
            await DataVersioningService.createVersion({
                entityType: 'post',
                entityId: salePost._id.toString(),
                data: postData,
                userId,
                operation: 'create',
                metadata: {
                    isForSale: true,
                    saleDetails,
                },
            });

            res.json({
                success: true,
                message: 'Sale post created successfully',
                post: {
                    id: salePost._id,
                    userId: salePost.userId,
                    type: salePost.type,
                    caption: salePost.caption,
                    media: salePost.media,
                    createdAt: salePost.createdAt,
                    isForSale: true,
                    saleDetails: salePost.saleDetails
                }
            });
        } else {
                // Create post in MongoDB
                const post = new Post(postData);

                await post.save();

                // Update user's post count in PostgreSQL
                await pgPool.query(
                    'UPDATE users SET posts_count = posts_count + 1 WHERE id = $1',
                    [userId]
                );

                // Create version record
                await DataVersioningService.createVersion({
                    entityType: 'post',
                    entityId: post._id.toString(),
                    data: postData,
                    userId,
                    operation: 'create',
                });

                // Cache the post data
                await SelectiveCacheService.registerPolicy({
                    entityType: 'post',
                    cacheable: true,
                    strategies: [{
                        key: 'content',
                        ttl: 600, // 10 minutes
                        priority: 'high',
                    }],
                    fallbackStrategy: 'cache_first',
                });

                res.json({
                    success: true,
                    message: 'Post created successfully',
                    post: {
                        id: post._id,
                        userId: post.userId,
                        type: post.type,
                        caption: post.caption,
                        media: post.media,
                        createdAt: post.createdAt,
                        isForSale: post.isForSale
                    }
                });
            }        
    } catch (error) {
        console.error('Create Post Error:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
};

export const getFeed = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;
        const offline = req.query.offline === 'true';

        // Try to get from cache first (if not offline request)
        if (!offline) {
            try {
                const cacheKey = `feed_${userId}_${page}_${limit}`;
                const cachedFeed = await SelectiveCacheService.get(
                    'post',
                    cacheKey,
                    async () => {
                        // Use personalized feed algorithm for better recommendations
        const { FeedAlgorithmService } = await import('../services/feed-algorithm.service');
        return await FeedAlgorithmService.getPersonalizedFeed(userId, page, limit, req.user.faculty);
                    },
                    {
                        userId,
                        priority: 'high',
                        accessPattern: 'read_heavy',
                    }
                );

                // Track cache hit
                await OfflineAnalyticsService.trackOfflineSession(
                    userId,
                    req.headers['x-session-id'] as string || `feed_${Date.now()}`,
                    {
                        deviceType: req.headers['x-device-type'] as string,
                        userAgent: req.headers['user-agent'] as string,
                    },
                    {
                        startTime: new Date(),
                        endTime: new Date(),
                        pagesViewed: 1,
                        actionsPerformed: 0,
                        dataSynced: 0,
                        errorsEncountered: 0,
                    }
                );

                return res.json({
                    success: true,
                    posts: cachedFeed.posts,
                    pagination: cachedFeed.pagination,
                    cached: true,
                });
            } catch (cacheError) {
                console.warn('Cache error, falling back to direct fetch:', cacheError);
            }
        }

        // Fetch fresh data
        const feedData = await fetchFeedData(userId, page, limit, req.user.faculty);

        res.json({
            success: true,
            posts: feedData.posts,
            pagination: feedData.pagination,
            cached: false,
        });

    } catch (error) {
        console.error('Get Feed Error:', error);

        // Try to get offline data if online request fails
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const offlineData = await OfflineDataService.getOfflineData(
                req.user.id,
                'feed',
                `feed_${req.user.id}_${page}_${limit}`
            );

            if (offlineData) {
                return res.json({
                    success: true,
                    posts: offlineData.data.posts || [],
                    pagination: offlineData.data.pagination || { page, limit, hasMore: false },
                    offline: true,
                    message: 'Serving cached offline data',
                });
            }
        } catch (offlineError) {
            console.error('Offline fallback failed:', offlineError);
        }

        res.status(500).json({ error: 'Failed to get feed' });
    }
};

// Get post suggestions
export const getPostSuggestions = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit as string) || 10;

        const { FeedAlgorithmService } = await import('../services/feed-algorithm.service');
        const suggestions = await FeedAlgorithmService.getPostSuggestions(userId, limit);

        // Enrich with user data
        const userIds = [...new Set(suggestions.map(p => p.userId))];
        const users = await pgPool.query(
            'SELECT id, username, first_name, last_name, avatar_url, faculty FROM users WHERE id = ANY($1)',
            [userIds]
        );

        const userMap: any = {};
        users.rows.forEach(u => {
            userMap[u.id] = {
                id: u.id,
                username: u.username,
                name: `${u.first_name} ${u.last_name}`,
                avatarUrl: u.avatar_url,
                faculty: u.faculty
            };
        });

        const enrichedSuggestions = suggestions.map(post => ({
            id: post._id.toString(),
            type: post.type,
            caption: post.caption,
            media: post.media,
            location: post.location,
            tags: post.tags || [],
            likesCount: post.likesCount || 0,
            commentsCount: post.commentsCount || 0,
            sharesCount: post.sharesCount || 0,
            viewsCount: post.viewsCount || 0,
            user: userMap[post.userId],
            faculty: post.faculty,
            createdAt: post.createdAt,
            isLiked: false, // Would need to check
        }));

        res.json({
            success: true,
            suggestions: enrichedSuggestions
        });
    } catch (error) {
        console.error('Get Post Suggestions Error:', error);
        res.status(500).json({ error: 'Failed to get post suggestions' });
    }
};

// Get trending posts
export const getTrendingPosts = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const timeWindow = (req.query.timeWindow as '24h' | '7d' | '30d') || '24h';

        const { FeedAlgorithmService } = await import('../services/feed-algorithm.service');
        const result = await FeedAlgorithmService.getTrendingPosts(userId, page, limit, timeWindow);

        // Enrich with user data (similar to getFeed)
        const userIds = [...new Set(result.posts.map(p => p.userId))];
        const users = await pgPool.query(
            'SELECT id, username, first_name, last_name, avatar_url, faculty FROM users WHERE id = ANY($1)',
            [userIds]
        );

        const userMap: any = {};
        users.rows.forEach(u => {
            userMap[u.id] = {
                id: u.id,
                username: u.username,
                name: `${u.first_name} ${u.last_name}`,
                avatarUrl: u.avatar_url,
                faculty: u.faculty
            };
        });

        const postIds = result.posts.map(p => p._id.toString());
        const likes = await Like.find({
            userId,
            targetId: { $in: postIds },
            targetType: 'post'
        }).lean();

        const likedPostIds = new Set(likes.map(l => l.targetId));

        const enrichedPosts = result.posts.map(post => ({
            id: post._id.toString(),
            type: post.type,
            caption: post.caption,
            media: post.media,
            location: post.location,
            tags: post.tags || [],
            likesCount: post.likesCount || 0,
            commentsCount: post.commentsCount || 0,
            sharesCount: post.sharesCount || 0,
            viewsCount: post.viewsCount || 0,
            user: userMap[post.userId],
            faculty: post.faculty,
            createdAt: post.createdAt,
            isLiked: likedPostIds.has(post._id.toString()),
        }));

        res.json({
            success: true,
            posts: enrichedPosts,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Get Trending Posts Error:', error);
        res.status(500).json({ error: 'Failed to get trending posts' });
    }
};

// Helper function to fetch feed data
async function fetchFeedData(userId: string, page: number, limit: number, faculty: string) {
    const skip = (page - 1) * limit;

    // Get user's connections for personalized feed
    const connections = await pgPool.query(
        'SELECT following_id FROM connections WHERE follower_id = $1',
        [userId]
    );

    const followingIds = connections.rows.map(r => r.following_id);
    followingIds.push(userId); // Include own posts

    // Get posts from MongoDB
    const posts = await Post.find({
        userId: { $in: followingIds },
        deletedAt: null,
        $or: [
        { visibility: 'public' },
        { visibility: 'connections', userId: { $in: followingIds } },
        { visibility: 'faculty', faculty }
        ]
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

    // Get user info for each post from PostgreSQL
    const userIds = [...new Set(posts.map(p => p.userId))];
    const users = await pgPool.query(
        'SELECT id, username, first_name, last_name, avatar_url, faculty FROM users WHERE id = ANY($1)',
        [userIds]
    );

    const userMap: any = {};
    users.rows.forEach(u => {
        userMap[u.id] = {
        id: u.id,
        username: u.username,
        name: `${u.first_name} ${u.last_name}`,
        avatarUrl: u.avatar_url,
        faculty: u.faculty
        };
    });

    // Check if current user liked each post
    const postIds = posts.map(p => p._id.toString());
    const likes = await Like.find({
        userId,
        targetId: { $in: postIds },
        targetType: 'post'
    }).lean();

    const likedPostIds = new Set(likes.map(l => l.targetId));

    // Enrich posts with user data and transform to frontend format
    const enrichedPosts = posts.map(post => ({
        id: post._id.toString(),
        user: {
            id: userMap[post.userId]?.id || post.userId,
            name: userMap[post.userId]?.name || 'Unknown User',
            username: userMap[post.userId]?.username,
            avatar: userMap[post.userId]?.avatarUrl || '',
            faculty: userMap[post.userId]?.faculty || 'Unknown'
        },
        caption: post.caption || '',
        media: {
            type: post.type,
            url: post.media?.image || post.media?.video,
            thumbnail: post.media?.thumbnail,
            items: post.media?.images || []
        },
        tags: post.tags || [],
        likes: post.likesCount || 0,
        comments: post.commentsCount || 0,
        shares: post.sharesCount || 0,
        timeAgo: getTimeAgo(post.createdAt),
        isLiked: likedPostIds.has(post._id.toString()),
        liked: likedPostIds.has(post._id.toString()),
        saved: false, // TODO: implement save functionality
        forSale: post.isForSale,
        price: post.saleDetails?.price,
        saleDetails: post.isForSale && post.saleDetails ? {
            itemName: post.caption || 'Fashion Item',
            price: (post.saleDetails as any).price,
            originalPrice: undefined,
            category: (post.saleDetails as any).category,
            condition: (post.saleDetails as any).condition,
            size: (post.saleDetails as any).size,
            brand: undefined,
            color: undefined,
            material: undefined,
            paymentMethods: (post.saleDetails as any).paymentMethods,
            meetupLocation: (post.saleDetails as any).meetupLocation,
            sellerPhone: (post.saleDetails as any).contactPhone,
            negotiable: false
        } : undefined,
        location: post.location,
        brand: post.brand,
        occasion: post.occasion,
        visibility: post.visibility,
        createdAt: post.createdAt
    }));

    return {
        posts: enrichedPosts,
        pagination: {
            page,
            limit,
            hasMore: posts.length === limit
        }
    };
}

export const getPost = async (req: Request, res: Response) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        
        const post = await Post.findOne({
            _id: postId,
            deletedAt: null
        }).lean();
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // Increment view count
        await Post.updateOne(
            { _id: postId },
            { $inc: { viewsCount: 1 } }
        );
        
        // Get post author info
        const user = await pgPool.query(
            'SELECT id, username, first_name, last_name, avatar_url, faculty FROM users WHERE id = $1',
            [post.userId]
        );
        
        // Check if liked
        const like = await Like.findOne({
            userId,
            targetId: postId,
            targetType: 'post'
        });
        
        res.json({
            success: true,
            post: {
                id: post._id.toString(),
                user: {
                    id: user.rows[0].id,
                    name: `${user.rows[0].first_name} ${user.rows[0].last_name}`,
                    username: user.rows[0].username,
                    avatar: user.rows[0].avatar_url || '',
                    faculty: user.rows[0].faculty
                },
                caption: post.caption || '',
                media: {
                    type: post.type,
                    url: post.media?.image || post.media?.video,
                    thumbnail: post.media?.thumbnail,
                    items: post.media?.images || []
                },
                tags: post.tags || [],
                likes: post.likesCount || 0,
                comments: post.commentsCount || 0,
                shares: post.sharesCount || 0,
                timeAgo: getTimeAgo(post.createdAt),
                isLiked: !!like,
                liked: !!like,
                saved: false, // TODO: implement save functionality
                forSale: post.isForSale,
                price: post.saleDetails?.price,
                saleDetails: post.isForSale && post.saleDetails ? {
                    itemName: post.caption || 'Fashion Item',
                    price: (post.saleDetails as any).price,
                    originalPrice: undefined,
                    category: (post.saleDetails as any).category,
                    condition: (post.saleDetails as any).condition,
                    size: (post.saleDetails as any).size,
                    brand: undefined,
                    color: undefined,
                    material: undefined,
                    paymentMethods: (post.saleDetails as any).paymentMethods,
                    meetupLocation: (post.saleDetails as any).meetupLocation,
                    sellerPhone: (post.saleDetails as any).contactPhone,
                    negotiable: false
                } : undefined,
                location: post.location,
                brand: post.brand,
                occasion: post.occasion,
                visibility: post.visibility,
                createdAt: post.createdAt
            }
        });
        
    } catch (error) {
        console.error('Get Post Error:', error);
        res.status(500).json({ error: 'Failed to get post' });
    }
};

export const likePost = async (req: Request, res: Response) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;
        const userSubscription = req.user.subscription_tier;

        // Check if user already liked the post
        const existingLike = await Like.findOne({
            userId,
            targetId: postId,
            targetType: 'post'
        });

        let liked = false;
        let action = '';

        if (existingLike) {
            // Unlike the post
            await Like.deleteOne({ _id: existingLike._id });
            await Post.updateOne(
                { _id: postId },
                { $inc: { likesCount: -1 } }
            );
            action = 'unliked';
        } else {
            // Like the post
            await Like.create({
                userId,
                targetId: postId,
                targetType: 'post'
            });
            await Post.updateOne(
                { _id: postId },
                { $inc: { likesCount: 1 } }
            );
            liked = true;
            action = 'liked';

            // Create notification for post author (if not liking own post)
            const post = await Post.findById(postId);
            if (post && post.userId !== userId) {
                const { Notification } = await import('../models/mongoose/notification.model');
                await Notification.create({
                    userId: post.userId,
                    type: 'post_like',
                    title: 'Someone liked your post',
                    message: 'liked your post',
                    actorId: userId,
                    data: { postId }
                });

                // Emit real-time notification
                const { io } = await import('../index');
                io.to(`user:${post.userId}`).emit('notification', {
                    type: 'post_like',
                    message: 'Someone liked your post',
                    actorId: userId,
                    postId
                });
            }
        }

        res.json({
            success: true,
            message: `Post ${action} successfully`,
            liked,
            action
        });
    } catch (error: any) {
        console.error('Like Post Error:', error);
        res.status(500).json({ error: error.message || 'Failed to like post' });
    }
};

export const commentOnPost = async (req: Request, res: Response) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { postId } = req.params;
        const userId = req.user.id;
        const { text, parentCommentId } = req.body;
        const userSubscription = req.user.subscription_tier;

        // Verify post exists
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Create comment
        const comment = await Comment.create({
            postId,
            userId,
            text,
            parentCommentId: parentCommentId || null
        });

        // Update post comment count
        await Post.updateOne(
            { _id: postId },
            { $inc: { commentsCount: 1 } }
        );

        // Create notification for post author (if not commenting on own post)
        if (post.userId !== userId) {
            const { Notification } = await import('../models/mongoose/notification.model');
            await Notification.create({
                userId: post.userId,
                type: 'post_comment',
                title: 'Someone commented on your post',
                message: 'commented on your post',
                actorId: userId,
                data: { postId, commentId: comment._id }
            });

            // Emit real-time notification
            const { io } = await import('../index');
            io.to(`user:${post.userId}`).emit('notification', {
                type: 'post_comment',
                message: 'Someone commented on your post',
                actorId: userId,
                postId,
                commentId: comment._id
            });
        }

        // If replying to a comment, notify the original commenter
        if (parentCommentId) {
            const parentComment = await Comment.findById(parentCommentId);
            if (parentComment && parentComment.userId !== userId && parentComment.userId !== post.userId) {
                const { Notification } = await import('../models/mongoose/notification.model');
                await Notification.create({
                    userId: parentComment.userId,
                    type: 'comment_reply',
                    title: 'Someone replied to your comment',
                    message: 'replied to your comment',
                    actorId: userId,
                    data: { postId, commentId: comment._id, parentCommentId }
                });

                // Emit real-time notification
                const { io } = await import('../index');
                io.to(`user:${parentComment.userId}`).emit('notification', {
                    type: 'comment_reply',
                    message: 'Someone replied to your comment',
                    actorId: userId,
                    postId,
                    commentId: comment._id
                });
            }
        }

        res.json({
            success: true,
            message: 'Comment created successfully',
            comment: {
                id: comment._id,
                text: comment.text,
                userId: comment.userId,
                postId: comment.postId,
                parentCommentId: comment.parentCommentId,
                createdAt: comment.createdAt,
                timeAgo: getTimeAgo(comment.createdAt)
            }
        });

    } catch (error: any) {
        console.error('Comment Error:', error);
        res.status(500).json({ error: error.message || 'Failed to create comment' });
    }
};

export const getPostComments = async (req: Request, res: Response) => {
    try {
        const { postId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;
        
        const comments = await Comment.find({
            postId,
            parentCommentId: null, // Only top-level comments
            deletedAt: null
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
        
        // Get user info for comments
        const userIds = [...new Set(comments.map(c => c.userId))];
        const users = await pgPool.query(
            'SELECT id, username, first_name, last_name, avatar_url FROM users WHERE id = ANY($1)',
            [userIds]
        );
        
        const userMap: any = {};
        users.rows.forEach(u => {
            userMap[u.id] = {
            id: u.id,
            username: u.username,
            name: `${u.first_name} ${u.last_name}`,
            avatarUrl: u.avatar_url
            };
        });
        
        const enrichedComments = comments.map(comment => ({
            ...comment,
            user: userMap[comment.userId],
            timeAgo: getTimeAgo(comment.createdAt)
        }));
        
        res.json({
            success: true,
            comments: enrichedComments,
            pagination: {
            page,
            limit,
            hasMore: comments.length === limit
            }
        });
        
    } catch (error) {
        console.error('Get Comments Error:', error);
        res.status(500).json({ error: 'Failed to get comments' });
    }
};

export const getFacultyPosts = async (req: Request, res: Response) => {
    try {
        const { facultyId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const userId = req.user.id;
        
        // Convert facultyId back to faculty name
        const facultyName = facultyId.replace(/-/g, ' ');
        
        const skip = (page - 1) * limit;
        
        // Get posts from MongoDB filtered by faculty
        const posts = await Post.find({
            faculty: facultyName,
            deletedAt: null,
            $or: [
                { visibility: 'public' },
                { visibility: 'faculty' }
            ]
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
        
        // Get user info for each post from PostgreSQL
        const userIds = [...new Set(posts.map(p => p.userId))];
        const users = await pgPool.query(
            'SELECT id, username, first_name, last_name, avatar_url, faculty FROM users WHERE id = ANY($1)',
            [userIds]
        );
        
        const userMap: any = {};
        users.rows.forEach(u => {
            userMap[u.id] = {
                id: u.id,
                username: u.username,
                name: `${u.first_name} ${u.last_name}`,
                avatarUrl: u.avatar_url,
                faculty: u.faculty
            };
        });
        
        // Check if current user liked each post
        const postIds = posts.map(p => p._id.toString());
        const likes = await Like.find({
            userId,
            targetId: { $in: postIds },
            targetType: 'post'
        }).lean();
        
        const likedPostIds = new Set(likes.map(l => l.targetId));
        
        // Enrich posts with user data
        const enrichedPosts = posts.map(post => ({
            id: post._id.toString(),
            user: {
                id: userMap[post.userId]?.id || post.userId,
                name: userMap[post.userId]?.name || 'Unknown User',
                username: userMap[post.userId]?.username,
                avatar: userMap[post.userId]?.avatarUrl || '',
                faculty: userMap[post.userId]?.faculty || 'Unknown'
            },
            caption: post.caption || '',
            media: {
                type: post.type,
                url: post.media?.image || post.media?.video,
                thumbnail: post.media?.thumbnail,
                items: post.media?.images || []
            },
            tags: post.tags || [],
            likes: post.likesCount || 0,
            comments: post.commentsCount || 0,
            shares: post.sharesCount || 0,
            timeAgo: getTimeAgo(post.createdAt),
            isLiked: likedPostIds.has(post._id.toString()),
            liked: likedPostIds.has(post._id.toString()),
            saved: false,
            forSale: post.isForSale,
            price: post.saleDetails?.price,
            saleDetails: post.isForSale && post.saleDetails ? {
                itemName: post.caption || 'Fashion Item',
                price: (post.saleDetails as any).price,
                originalPrice: undefined,
                category: (post.saleDetails as any).category,
                condition: (post.saleDetails as any).condition,
                size: (post.saleDetails as any).size,
                brand: undefined,
                color: undefined,
                material: undefined,
                paymentMethods: (post.saleDetails as any).paymentMethods,
                meetupLocation: (post.saleDetails as any).meetupLocation,
                sellerPhone: (post.saleDetails as any).contactPhone,
                negotiable: false
            } : undefined
        }));
        
        res.json({
            success: true,
            posts: enrichedPosts,
            pagination: {
                page,
                limit,
                hasMore: posts.length === limit
            }
        });
        
    } catch (error) {
        console.error('Get Faculty Posts Error:', error);
        res.status(500).json({ error: 'Failed to get faculty posts' });
    }
};