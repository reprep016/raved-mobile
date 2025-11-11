"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchService = void 0;
const database_1 = require("../config/database");
const post_model_1 = require("../models/mongoose/post.model");
const utils_1 = require("../utils");
// Advanced query parser
const parseSearchQuery = (query) => {
    const terms = [];
    const phrases = [];
    const excluded = [];
    // Extract quoted phrases
    const phraseRegex = /"([^"]*)"/g;
    let match;
    while ((match = phraseRegex.exec(query)) !== null) {
        phrases.push(match[1]);
    }
    // Remove phrases from query
    let cleanQuery = query.replace(phraseRegex, '').trim();
    // Split by spaces and handle operators
    const words = cleanQuery.split(/\s+/);
    for (const word of words) {
        if (word.startsWith('-')) {
            excluded.push(word.substring(1));
        }
        else if (word.toUpperCase() === 'AND' || word.toUpperCase() === 'OR') {
            // Handle operators if needed
        }
        else if (word.length > 0) {
            terms.push(word);
        }
    }
    return { terms, phrases, excluded };
};
// Build SQL WHERE clause from parsed query
const buildSearchCondition = (parsedQuery, field) => {
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    // Add phrase matches (highest priority)
    for (const phrase of parsedQuery.phrases) {
        conditions.push(`${field} ILIKE $${paramIndex}`);
        params.push(`%${phrase}%`);
        paramIndex++;
    }
    // Add term matches
    for (const term of parsedQuery.terms) {
        conditions.push(`${field} ILIKE $${paramIndex}`);
        params.push(`%${term}%`);
        paramIndex++;
    }
    // Add exclusions
    for (const exclude of parsedQuery.excluded) {
        conditions.push(`${field} NOT ILIKE $${paramIndex}`);
        params.push(`%${exclude}%`);
        paramIndex++;
    }
    return {
        condition: conditions.length > 0 ? `(${conditions.join(' OR ')})` : 'TRUE',
        params
    };
};
const searchServiceInternal = {
    // Search suggestions and autocomplete
    getSuggestions: async (query, type = 'all', limit = 10) => {
        const parsedQuery = parseSearchQuery(query);
        const suggestions = [];
        if (type === 'all' || type === 'users') {
            const userQuery = `
        SELECT DISTINCT username, first_name, last_name
        FROM users
        WHERE (username ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1)
        AND deleted_at IS NULL
        ORDER BY followers_count DESC
        LIMIT $2
      `;
            const userResult = await database_1.pgPool.query(userQuery, [`${query}%`, limit]);
            userResult.rows.forEach(row => {
                suggestions.push(row.username);
                if (row.first_name && row.last_name) {
                    suggestions.push(`${row.first_name} ${row.last_name}`);
                }
            });
        }
        if (type === 'all' || type === 'items') {
            const itemQuery = `
        SELECT DISTINCT name, category, brand
        FROM store_items
        WHERE (name ILIKE $1 OR category ILIKE $1 OR brand ILIKE $1)
        AND status = 'active' AND deleted_at IS NULL
        ORDER BY likes_count DESC
        LIMIT $2
      `;
            const itemResult = await database_1.pgPool.query(itemQuery, [`${query}%`, limit]);
            itemResult.rows.forEach(row => {
                if (row.name)
                    suggestions.push(row.name);
                if (row.category)
                    suggestions.push(row.category);
                if (row.brand)
                    suggestions.push(row.brand);
            });
        }
        if (type === 'all' || type === 'events') {
            const eventQuery = `
        SELECT DISTINCT title, category, location
        FROM events
        WHERE (title ILIKE $1 OR category ILIKE $1 OR location ILIKE $1)
        AND deleted_at IS NULL
        ORDER BY current_attendees DESC
        LIMIT $2
      `;
            const eventResult = await database_1.pgPool.query(eventQuery, [`${query}%`, limit]);
            eventResult.rows.forEach(row => {
                if (row.title)
                    suggestions.push(row.title);
                if (row.category)
                    suggestions.push(row.category);
                if (row.location)
                    suggestions.push(row.location);
            });
        }
        return Array.from(new Set(suggestions)).slice(0, limit);
    },
    // Search analytics
    trackSearch: async (userId, query, type, resultCount, filters) => {
        const queryText = `
      INSERT INTO search_analytics (user_id, query, search_type, result_count, filters, searched_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `;
        await database_1.pgPool.query(queryText, [userId, query, type, resultCount, JSON.stringify(filters)]);
    },
    getPopularSearches: async (limit = 20) => {
        const query = `
      SELECT query, search_type, COUNT(*) as search_count
      FROM search_analytics
      WHERE searched_at >= NOW() - INTERVAL '30 days'
      GROUP BY query, search_type
      ORDER BY search_count DESC
      LIMIT $1
    `;
        const result = await database_1.pgPool.query(query, [limit]);
        return result.rows;
    },
    // Saved searches
    saveSearch: async (userId, name, query, type, filters) => {
        const queryText = `
      INSERT INTO saved_searches (user_id, name, query, search_type, filters, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id
    `;
        const result = await database_1.pgPool.query(queryText, [userId, name, query, type, JSON.stringify(filters)]);
        return result.rows[0].id;
    },
    getSavedSearches: async (userId) => {
        const query = `
      SELECT id, name, query, search_type, filters, created_at
      FROM saved_searches
      WHERE user_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
        const result = await database_1.pgPool.query(query, [userId]);
        return result.rows.map(row => ({
            ...row,
            filters: JSON.parse(row.filters)
        }));
    },
    deleteSavedSearch: async (userId, searchId) => {
        const query = `
      UPDATE saved_searches
      SET deleted_at = NOW()
      WHERE id = $1 AND user_id = $2
    `;
        await database_1.pgPool.query(query, [searchId, userId]);
    },
    // Export search results
    exportSearchResults: async (results, format = 'json') => {
        if (format === 'json') {
            return JSON.stringify(results, null, 2);
        }
        // CSV export
        const csvRows = [];
        // Users
        if (results.users && results.users.length > 0) {
            csvRows.push('Users');
            csvRows.push('Username,Name,Faculty,Bio,Followers,Posts');
            results.users.forEach((user) => {
                csvRows.push(`${user.username},"${user.name}",${user.faculty},"${user.bio}",${user.stats.followers},${user.stats.posts}`);
            });
            csvRows.push('');
        }
        // Items
        if (results.items && results.items.length > 0) {
            csvRows.push('Items');
            csvRows.push('Name,Price,Category,Condition,Seller');
            results.items.forEach((item) => {
                csvRows.push(`"${item.name}",${item.price},${item.category},${item.condition},"${item.seller.name}"`);
            });
            csvRows.push('');
        }
        // Events
        if (results.events && results.events.length > 0) {
            csvRows.push('Events');
            csvRows.push('Title,Date,Location,Category,Attendees,Organizer');
            results.events.forEach((event) => {
                csvRows.push(`"${event.title}",${event.eventDate},${event.location},${event.category},${event.currentAttendees},"${event.organizer.name}"`);
            });
        }
        return csvRows.join('\n');
    },
};
exports.searchService = {
    ...searchServiceInternal,
    advancedSearch: async (q, type, filters = {}, sortBy = 'relevance', page = 1, limit = 20) => {
        const parsedQuery = parseSearchQuery(q);
        const offset = (page - 1) * limit;
        const results = {
            users: [],
            posts: [],
            items: [],
            events: [],
            faculties: []
        };
        // Search users with ranking
        if (type === 'all' || type === 'users') {
            const userCondition = buildSearchCondition(parsedQuery, 'username, first_name, last_name, bio, faculty');
            const userQuery = `
        SELECT id, username, first_name, last_name, avatar_url, faculty, bio,
               followers_count, posts_count,
               -- Relevance scoring
               CASE
                 WHEN username ILIKE $${userCondition.params.length + 1} THEN 100
                 WHEN first_name ILIKE $${userCondition.params.length + 1} OR last_name ILIKE $${userCondition.params.length + 1} THEN 80
                 WHEN bio ILIKE $${userCondition.params.length + 1} THEN 60
                 ELSE 20
               END as relevance_score
        FROM users
        WHERE ${userCondition.condition}
        AND deleted_at IS NULL
        ${filters.faculty ? `AND faculty = $${userCondition.params.length + 2}` : ''}
        ORDER BY relevance_score DESC, followers_count DESC
        LIMIT $${userCondition.params.length + (filters.faculty ? 3 : 2)} OFFSET $${userCondition.params.length + (filters.faculty ? 4 : 3)}
      `;
            const userParams = [...userCondition.params, q.trim().toLowerCase()];
            if (filters.faculty)
                userParams.push(filters.faculty);
            userParams.push(limit);
            userParams.push(offset);
            const userResult = await database_1.pgPool.query(userQuery, userParams);
            results.users = userResult.rows.map(u => ({
                id: u.id,
                username: u.username,
                name: `${u.first_name} ${u.last_name}`,
                avatarUrl: (0, utils_1.getAvatarUrl)(u.avatar_url, u.id),
                faculty: u.faculty,
                bio: u.bio,
                stats: {
                    followers: u.followers_count,
                    posts: u.posts_count
                },
                relevance: u.relevance_score
            }));
        }
        // Search posts with engagement ranking
        if (type === 'all' || type === 'posts') {
            const postConditions = [];
            const postParams = [];
            // Build MongoDB regex conditions from parsed query
            if (parsedQuery.phrases.length > 0) {
                postConditions.push({
                    $or: [
                        { caption: { $regex: parsedQuery.phrases.join('|'), $options: 'i' } },
                        { tags: { $regex: parsedQuery.phrases.join('|'), $options: 'i' } },
                        { location: { $regex: parsedQuery.phrases.join('|'), $options: 'i' } }
                    ]
                });
            }
            if (parsedQuery.terms.length > 0) {
                postConditions.push({
                    $or: [
                        { caption: { $regex: parsedQuery.terms.join('|'), $options: 'i' } },
                        { tags: { $regex: parsedQuery.terms.join('|'), $options: 'i' } },
                        { location: { $regex: parsedQuery.terms.join('|'), $options: 'i' } }
                    ]
                });
            }
            const matchCondition = {
                deletedAt: null,
                visibility: 'public'
            };
            if (postConditions.length > 0) {
                matchCondition.$or = postConditions;
            }
            // Add date filters
            if (filters.dateFrom) {
                matchCondition.createdAt = { ...matchCondition.createdAt, $gte: new Date(filters.dateFrom) };
            }
            if (filters.dateTo) {
                matchCondition.createdAt = { ...matchCondition.createdAt, $lte: new Date(filters.dateTo) };
            }
            const posts = await post_model_1.Post.aggregate([
                { $match: matchCondition },
                {
                    $addFields: {
                        engagementScore: {
                            $add: [
                                { $multiply: ['$likesCount', 2] },
                                { $multiply: ['$commentsCount', 3] },
                                { $multiply: ['$sharesCount', 5] }
                            ]
                        },
                        relevanceScore: {
                            $cond: {
                                if: { $regexMatch: { input: '$caption', regex: q, options: 'i' } },
                                then: 100,
                                else: 50
                            }
                        }
                    }
                },
                {
                    $sort: {
                        relevanceScore: -1,
                        engagementScore: -1,
                        createdAt: -1
                    }
                },
                { $skip: offset },
                { $limit: limit }
            ]);
            // Get user info for posts
            const userIds = posts.map(p => p.userId);
            const users = await database_1.pgPool.query('SELECT id, username, first_name, last_name, avatar_url FROM users WHERE id = ANY($1)', [userIds]);
            const userMap = {};
            users.rows.forEach(u => {
                userMap[u.id] = {
                    username: u.username,
                    name: `${u.first_name} ${u.last_name}`,
                    avatarUrl: (0, utils_1.getAvatarUrl)(u.avatar_url, u.id)
                };
            });
            results.posts = posts.map(p => ({
                id: p._id,
                caption: p.caption,
                media: p.media,
                user: userMap[p.userId],
                likesCount: p.likesCount,
                commentsCount: p.commentsCount,
                engagement: p.engagementScore,
                createdAt: p.createdAt
            }));
        }
        // Search store items with filters
        if (type === 'all' || type === 'items') {
            const itemCondition = buildSearchCondition(parsedQuery, 'name, description, category, brand');
            let itemQuery = `
        SELECT id, name, description, price, category, condition, size, brand,
               images, seller_id, views_count, likes_count, saves_count,
               -- Relevance scoring
               CASE
                 WHEN name ILIKE $${itemCondition.params.length + 1} THEN 100
                 WHEN description ILIKE $${itemCondition.params.length + 1} THEN 80
                 WHEN category ILIKE $${itemCondition.params.length + 1} THEN 60
                 ELSE 20
               END as relevance_score
        FROM store_items
        WHERE ${itemCondition.condition}
        AND status = 'active' AND deleted_at IS NULL
      `;
            const itemParams = [...itemCondition.params, q.trim().toLowerCase()];
            let itemParamIndex = itemCondition.params.length + 2;
            if (filters.category) {
                itemQuery += ` AND category = $${itemParamIndex}`;
                itemParams.push(filters.category);
                itemParamIndex++;
            }
            if (filters.minPrice !== undefined) {
                itemQuery += ` AND price >= $${itemParamIndex}`;
                itemParams.push(filters.minPrice);
                itemParamIndex++;
            }
            if (filters.maxPrice !== undefined) {
                itemQuery += ` AND price <= $${itemParamIndex}`;
                itemParams.push(filters.maxPrice);
                itemParamIndex++;
            }
            if (filters.condition) {
                itemQuery += ` AND condition = $${itemParamIndex}`;
                itemParams.push(filters.condition);
                itemParamIndex++;
            }
            if (filters.location) {
                itemQuery += ` AND location ILIKE $${itemParamIndex}`;
                itemParams.push(`%${filters.location}%`);
                itemParamIndex++;
            }
            const itemSortMap = {
                'relevance': 'relevance_score DESC',
                'newest': 'created_at DESC',
                'price-low': 'price ASC',
                'price-high': 'price DESC',
                'popular': 'likes_count DESC'
            };
            itemQuery += ` ORDER BY ${itemSortMap[sortBy] || 'relevance_score DESC'}`;
            itemQuery += ` LIMIT $${itemParamIndex} OFFSET $${itemParamIndex + 1}`;
            itemParams.push(limit, offset);
            const itemResult = await database_1.pgPool.query(itemQuery, itemParams);
            const sellerIds = Array.from(new Set(itemResult.rows.map(item => item.seller_id)));
            const sellers = await database_1.pgPool.query('SELECT id, username, first_name, last_name, avatar_url FROM users WHERE id = ANY($1)', [sellerIds]);
            const sellerMap = {};
            sellers.rows.forEach(s => {
                sellerMap[s.id] = {
                    id: s.id,
                    username: s.username,
                    name: `${s.first_name} ${s.last_name}`,
                    avatarUrl: (0, utils_1.getAvatarUrl)(s.avatar_url, s.id)
                };
            });
            results.items = itemResult.rows.map(item => ({
                id: item.id,
                name: item.name,
                description: item.description,
                price: parseFloat(item.price),
                category: item.category,
                condition: item.condition,
                images: item.images,
                seller: sellerMap[item.seller_id],
                likesCount: item.likes_count,
                savesCount: item.saves_count,
                relevance: item.relevance_score
            }));
        }
        // Search events
        if (type === 'all' || type === 'events') {
            const eventCondition = buildSearchCondition(parsedQuery, 'title, description, location, category');
            let eventQuery = `
        SELECT id, title, description, event_date, location, category, organizer_id,
               current_attendees, max_attendees,
               CASE
                 WHEN title ILIKE $${eventCondition.params.length + 1} THEN 100
                 WHEN description ILIKE $${eventCondition.params.length + 1} THEN 80
                 WHEN location ILIKE $${eventCondition.params.length + 1} THEN 60
                 ELSE 20
               END as relevance_score
        FROM events
        WHERE ${eventCondition.condition}
        AND deleted_at IS NULL
      `;
            const eventParams = [...eventCondition.params, q.trim().toLowerCase()];
            let eventParamIndex = eventCondition.params.length + 2;
            if (filters.category) {
                eventQuery += ` AND category = $${eventParamIndex}`;
                eventParams.push(filters.category);
                eventParamIndex++;
            }
            if (filters.location) {
                eventQuery += ` AND location ILIKE $${eventParamIndex}`;
                eventParams.push(`%${filters.location}%`);
                eventParamIndex++;
            }
            if (filters.eventDateFrom) {
                eventQuery += ` AND event_date >= $${eventParamIndex}`;
                eventParams.push(filters.eventDateFrom);
                eventParamIndex++;
            }
            if (filters.eventDateTo) {
                eventQuery += ` AND event_date <= $${eventParamIndex}`;
                eventParams.push(filters.eventDateTo);
                eventParamIndex++;
            }
            const eventSortMap = {
                'relevance': 'relevance_score DESC',
                'newest': 'created_at DESC',
                'event-date': 'event_date ASC'
            };
            eventQuery += ` ORDER BY ${eventSortMap[sortBy] || 'relevance_score DESC'}`;
            eventQuery += ` LIMIT $${eventParamIndex} OFFSET $${eventParamIndex + 1}`;
            eventParams.push(limit, offset);
            const eventResult = await database_1.pgPool.query(eventQuery, eventParams);
            const organizerIds = Array.from(new Set(eventResult.rows.map(event => event.organizer_id)));
            const organizers = await database_1.pgPool.query('SELECT id, username, first_name, last_name FROM users WHERE id = ANY($1)', [organizerIds]);
            const organizerMap = {};
            organizers.rows.forEach(o => {
                organizerMap[o.id] = {
                    id: o.id,
                    username: o.username,
                    name: `${o.first_name} ${o.last_name}`
                };
            });
            results.events = eventResult.rows.map(event => ({
                id: event.id,
                title: event.title,
                description: event.description,
                eventDate: event.event_date,
                location: event.location,
                category: event.category,
                organizer: organizerMap[event.organizer_id],
                currentAttendees: event.current_attendees,
                maxAttendees: event.max_attendees,
                relevance: event.relevance_score
            }));
        }
        // Search faculties (simple list for now)
        if (type === 'all' || type === 'faculties') {
            const facultyCondition = buildSearchCondition(parsedQuery, 'faculty');
            const facultyQuery = `
        SELECT DISTINCT faculty
        FROM users
        WHERE ${facultyCondition.condition} AND faculty IS NOT NULL
        ORDER BY faculty
        LIMIT $${facultyCondition.params.length + 1} OFFSET $${facultyCondition.params.length + 2}
      `;
            const facultyParams = [...facultyCondition.params, limit, offset];
            const facultyResult = await database_1.pgPool.query(facultyQuery, facultyParams);
            results.faculties = facultyResult.rows.map(row => row.faculty);
        }
        return results;
    }
};
