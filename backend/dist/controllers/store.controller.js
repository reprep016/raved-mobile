"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStoreItem = exports.getStoreItem = exports.getStoreItems = void 0;
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const getStoreItems = async (req, res) => {
    try {
        const { category, sort, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let query = 'SELECT * FROM store_items WHERE status = $1 AND deleted_at IS NULL';
        const params = ['active'];
        let paramIndex = 2;
        // Filter by category
        if (category && category !== 'all') {
            query += ` AND category = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }
        // Filter by price range
        if (minPrice) {
            query += ` AND price >= $${paramIndex}`;
            params.push(parseFloat(minPrice));
            paramIndex++;
        }
        if (maxPrice) {
            query += ` AND price <= $${paramIndex}`;
            params.push(parseFloat(maxPrice));
            paramIndex++;
        }
        // Sorting
        const sortMap = {
            'newest': 'created_at DESC',
            'price-low': 'price ASC',
            'price-high': 'price DESC',
            'popular': 'likes_count DESC'
        };
        query += ` ORDER BY ${sortMap[sort] || 'created_at DESC'}`;
        // Pagination
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(parseInt(limit), offset);
        const result = await database_1.pgPool.query(query, params);
        // Get seller info for each item
        const sellerIds = [...new Set(result.rows.map(item => item.seller_id))];
        const sellers = await database_1.pgPool.query('SELECT id, username, first_name, last_name, avatar_url, faculty FROM users WHERE id = ANY($1)', [sellerIds]);
        const sellerMap = {};
        sellers.rows.forEach(s => {
            sellerMap[s.id] = {
                id: s.id,
                name: `${s.first_name} ${s.last_name}`,
                avatar: s.avatar_url || '',
                faculty: s.faculty,
                rating: 4.5, // Default rating, could be calculated from reviews
                itemsSold: 0 // TODO: calculate from sales data
            };
        });
        const items = result.rows.map(item => ({
            id: item.id.toString(),
            name: item.name,
            description: item.description,
            price: parseFloat(item.price),
            originalPrice: item.original_price ? parseFloat(item.original_price) : undefined,
            images: item.images || [],
            condition: item.condition,
            size: item.size,
            category: item.category,
            brand: item.brand,
            seller: sellerMap[item.seller_id],
            stats: {
                likes: item.likes_count || 0,
                views: item.views_count || 0,
                saves: item.saves_count || 0
            },
            likesCount: item.likes_count || 0,
            viewsCount: item.views_count || 0,
            savesCount: item.saves_count || 0,
            paymentMethods: item.payment_methods || [],
            meetupLocation: item.meetup_location,
            timestamp: new Date(item.created_at).getTime(),
            tags: [] // TODO: implement tags system
        }));
        res.json({
            success: true,
            items,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                hasMore: items.length === parseInt(limit)
            }
        });
    }
    catch (error) {
        console.error('Get Store Items Error:', error);
        res.status(500).json({ error: 'Failed to get store items' });
    }
};
exports.getStoreItems = getStoreItems;
const getStoreItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        const result = await database_1.pgPool.query('SELECT * FROM store_items WHERE id = $1 AND deleted_at IS NULL', [itemId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        const item = result.rows[0];
        // Increment views
        await database_1.pgPool.query('UPDATE store_items SET views_count = views_count + 1 WHERE id = $1', [itemId]);
        // Get seller info
        const seller = await database_1.pgPool.query('SELECT id, username, first_name, last_name, avatar_url, faculty FROM users WHERE id = $1', [item.seller_id]);
        res.json({
            success: true,
            item: {
                id: item.id.toString(),
                name: item.name,
                description: item.description,
                price: parseFloat(item.price),
                originalPrice: item.original_price ? parseFloat(item.original_price) : undefined,
                images: item.images || [],
                condition: item.condition,
                size: item.size,
                category: item.category,
                brand: item.brand,
                seller: {
                    id: seller.rows[0].id,
                    name: `${seller.rows[0].first_name} ${seller.rows[0].last_name}`,
                    avatar: seller.rows[0].avatar_url || '',
                    faculty: seller.rows[0].faculty,
                    rating: 4.5,
                    itemsSold: item.sales_count || 0
                },
                stats: {
                    likes: item.likes_count || 0,
                    views: item.views_count + 1,
                    saves: item.saves_count || 0
                },
                likesCount: item.likes_count || 0,
                viewsCount: item.views_count + 1,
                savesCount: item.saves_count || 0,
                paymentMethods: item.payment_methods || [],
                meetupLocation: item.meetup_location,
                timestamp: new Date(item.created_at).getTime(),
                tags: [] // TODO: implement tags system
            }
        });
    }
    catch (error) {
        console.error('Get Store Item Error:', error);
        res.status(500).json({ error: 'Failed to get item' });
    }
};
exports.getStoreItem = getStoreItem;
const createStoreItem = async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const userId = req.user.id;
        const { name, description, price, originalPrice, category, condition, size, brand, color, material, images, paymentMethods, meetupLocation, sellerPhone } = req.body;
        const result = await database_1.pgPool.query(`
            INSERT INTO store_items (
            seller_id, name, description, price, original_price,
            category, condition, size, brand, color, material,
            images, payment_methods, meetup_location, seller_phone
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `, [
            userId, name, description, price, originalPrice || null,
            category, condition, size, brand, color, material,
            images || [], paymentMethods || [], meetupLocation, sellerPhone
        ]);
        const item = result.rows[0];
        res.status(201).json({
            success: true,
            item
        });
    }
    catch (error) {
        console.error('Create Store Item Error:', error);
        res.status(500).json({ error: 'Failed to create store item' });
    }
};
exports.createStoreItem = createStoreItem;
