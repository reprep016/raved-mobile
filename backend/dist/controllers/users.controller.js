"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersController = void 0;
const database_1 = require("../config/database");
const mongoose_1 = require("../models/mongoose");
const utils_1 = require("../utils");
exports.usersController = {
    // Get user profile
    getProfile: async (req, res) => {
        try {
            const { userId } = req.params;
            const targetUserId = userId || req.user.id;
            const userResult = await database_1.pgPool.query(`
        SELECT 
          id, username, email, phone, first_name, last_name, avatar_url, bio,
          location, website, faculty, university, subscription_tier,
          followers_count, following_count, posts_count,
          created_at, updated_at
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
      `, [targetUserId]);
            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }
            const user = userResult.rows[0];
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    phone: user.phone,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    avatarUrl: user.avatar_url,
                    bio: user.bio,
                    location: user.location,
                    website: user.website,
                    faculty: user.faculty,
                    university: user.university,
                    isVerified: false, // TODO: implement verification
                    isPremium: user.subscription_tier === 'premium',
                    followersCount: parseInt(user.followers_count) || 0,
                    followingCount: parseInt(user.following_count) || 0,
                    postsCount: parseInt(user.posts_count) || 0,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at,
                }
            });
        }
        catch (error) {
            console.error('Get Profile Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch profile'
            });
        }
    },
    // Update user profile
    updateProfile: async (req, res) => {
        try {
            const userId = req.user.id;
            const { firstName, lastName, username, bio, location, website, faculty, } = req.body;
            const updateFields = [];
            const values = [];
            let paramIndex = 1;
            if (firstName !== undefined) {
                updateFields.push(`first_name = $${paramIndex++}`);
                values.push(firstName);
            }
            if (lastName !== undefined) {
                updateFields.push(`last_name = $${paramIndex++}`);
                values.push(lastName);
            }
            if (username !== undefined) {
                updateFields.push(`username = $${paramIndex++}`);
                values.push(username.toLowerCase());
            }
            if (bio !== undefined) {
                updateFields.push(`bio = $${paramIndex++}`);
                values.push(bio);
            }
            if (location !== undefined) {
                updateFields.push(`location = $${paramIndex++}`);
                values.push(location);
            }
            if (website !== undefined) {
                updateFields.push(`website = $${paramIndex++}`);
                values.push(website);
            }
            if (faculty !== undefined) {
                updateFields.push(`faculty = $${paramIndex++}`);
                values.push(faculty);
            }
            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No fields to update'
                });
            }
            updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(userId);
            await database_1.pgPool.query(`
        UPDATE users
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
      `, values);
            // Get updated profile
            const userResult = await database_1.pgPool.query(`
        SELECT id, username, first_name, last_name, avatar_url, bio, location, website, faculty
        FROM users
        WHERE id = $1
      `, [userId]);
            res.json({
                success: true,
                user: {
                    id: userResult.rows[0].id,
                    username: userResult.rows[0].username,
                    firstName: userResult.rows[0].first_name,
                    lastName: userResult.rows[0].last_name,
                    avatarUrl: userResult.rows[0].avatar_url,
                    bio: userResult.rows[0].bio,
                    location: userResult.rows[0].location,
                    website: userResult.rows[0].website,
                    faculty: userResult.rows[0].faculty,
                }
            });
        }
        catch (error) {
            console.error('Update Profile Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update profile'
            });
        }
    },
    // Update avatar
    updateAvatar: async (req, res) => {
        try {
            const userId = req.user.id;
            const { avatarUrl } = req.body;
            await database_1.pgPool.query(`
        UPDATE users
        SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [avatarUrl, userId]);
            res.json({
                success: true,
                avatarUrl
            });
        }
        catch (error) {
            console.error('Update Avatar Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update avatar'
            });
        }
    },
    // Get user stats
    getUserStats: async (req, res) => {
        try {
            const { userId } = req.params;
            const targetUserId = userId || req.user.id;
            const statsResult = await database_1.pgPool.query(`
        SELECT 
          posts_count, followers_count, following_count
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
      `, [targetUserId]);
            if (statsResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }
            const stats = statsResult.rows[0];
            // Get total likes received
            const likesResult = await mongoose_1.Like.aggregate([
                {
                    $match: {
                        targetType: 'post',
                        targetId: { $exists: true }
                    }
                },
                {
                    $lookup: {
                        from: 'posts',
                        localField: 'targetId',
                        foreignField: '_id',
                        as: 'post'
                    }
                },
                {
                    $match: {
                        'post.userId': targetUserId
                    }
                },
                {
                    $count: 'total'
                }
            ]);
            const totalLikes = likesResult[0]?.total || 0;
            res.json({
                success: true,
                stats: {
                    postCount: parseInt(stats.posts_count) || 0,
                    followerCount: parseInt(stats.followers_count) || 0,
                    followingCount: parseInt(stats.following_count) || 0,
                    likeCount: totalLikes,
                }
            });
        }
        catch (error) {
            console.error('Get User Stats Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch user stats'
            });
        }
    },
    // Get user posts
    getUserPosts: async (req, res) => {
        try {
            const { userId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;
            const posts = await mongoose_1.Post.find({
                userId,
                deletedAt: null
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();
            // Get user info
            const userResult = await database_1.pgPool.query(`
        SELECT id, username, first_name, last_name, avatar_url, faculty
        FROM users WHERE id = $1
      `, [userId]);
            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }
            const user = userResult.rows[0];
            const userMap = {
                id: user.id,
                username: user.username,
                name: `${user.first_name} ${user.last_name}`,
                avatarUrl: user.avatar_url,
                faculty: user.faculty
            };
            // Check if current user liked each post
            const currentUserId = req.user.id;
            const postIds = posts.map(p => p._id.toString());
            const likes = await mongoose_1.Like.find({
                userId: currentUserId,
                targetId: { $in: postIds },
                targetType: 'post'
            }).lean();
            const likedPostIds = new Set(likes.map(l => l.targetId));
            const enrichedPosts = posts.map(post => ({
                id: post._id.toString(),
                user: userMap,
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
                timeAgo: (0, utils_1.getTimeAgo)(post.createdAt),
                isLiked: likedPostIds.has(post._id.toString()),
                liked: likedPostIds.has(post._id.toString()),
                saved: false,
                forSale: post.isForSale,
                price: post.saleDetails?.price,
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
        }
        catch (error) {
            console.error('Get User Posts Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch user posts'
            });
        }
    },
    // Get user comments
    getUserComments: async (req, res) => {
        try {
            const { userId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;
            const comments = await mongoose_1.Comment.find({
                userId,
                deletedAt: null
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();
            // Get post info for each comment
            const postIds = [...new Set(comments.map(c => c.postId))];
            const posts = await mongoose_1.Post.find({
                _id: { $in: postIds }
            }).lean();
            const postMap = {};
            posts.forEach(post => {
                postMap[post._id.toString()] = post;
            });
            const enrichedComments = comments.map(comment => ({
                id: comment._id.toString(),
                text: comment.text,
                postId: comment.postId,
                post: postMap[comment.postId] ? {
                    id: postMap[comment.postId]._id.toString(),
                    caption: postMap[comment.postId].caption,
                    media: postMap[comment.postId].media,
                } : null,
                timeAgo: (0, utils_1.getTimeAgo)(comment.createdAt),
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
        }
        catch (error) {
            console.error('Get User Comments Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch user comments'
            });
        }
    },
    // Get user liked posts
    getUserLikedPosts: async (req, res) => {
        try {
            const { userId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;
            const likes = await mongoose_1.Like.find({
                userId,
                targetType: 'post'
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();
            const postIds = likes.map(l => l.targetId);
            const posts = await mongoose_1.Post.find({
                _id: { $in: postIds },
                deletedAt: null
            }).lean();
            // Get user info for each post
            const userIds = [...new Set(posts.map(p => p.userId))];
            const users = await database_1.pgPool.query(`
        SELECT id, username, first_name, last_name, avatar_url, faculty
        FROM users WHERE id = ANY($1)
      `, [userIds]);
            const userMap = {};
            users.rows.forEach(u => {
                userMap[u.id] = {
                    id: u.id,
                    username: u.username,
                    name: `${u.first_name} ${u.last_name}`,
                    avatarUrl: u.avatar_url,
                    faculty: u.faculty
                };
            });
            const enrichedPosts = posts.map(post => ({
                id: post._id.toString(),
                user: userMap[post.userId] || { id: post.userId, name: 'Unknown User' },
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
                timeAgo: (0, utils_1.getTimeAgo)(post.createdAt),
                isLiked: true,
                liked: true,
                saved: false,
                forSale: post.isForSale,
                price: post.saleDetails?.price,
            }));
            res.json({
                success: true,
                posts: enrichedPosts,
                pagination: {
                    page,
                    limit,
                    hasMore: likes.length === limit
                }
            });
        }
        catch (error) {
            console.error('Get User Liked Posts Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch liked posts'
            });
        }
    },
    // Get user saved posts (bookmarked)
    getUserSavedPosts: async (req, res) => {
        try {
            const { userId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;
            // TODO: Implement saved posts/bookmarks collection
            // For now, return empty array
            res.json({
                success: true,
                posts: [],
                pagination: {
                    page,
                    limit,
                    hasMore: false
                }
            });
        }
        catch (error) {
            console.error('Get User Saved Posts Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch saved posts'
            });
        }
    },
};
