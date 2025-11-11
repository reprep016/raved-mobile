"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchController = void 0;
const search_service_1 = require("../services/search.service");
exports.searchController = {
    advancedSearch: async (req, res) => {
        try {
            const { q, type = 'all', category, faculty, minPrice, maxPrice, condition, sortBy = 'relevance', page = 1, limit = 20 } = req.query;
            if (!q || q.trim().length < 2) {
                return res.status(400).json({ error: 'Query too short' });
            }
            const results = await search_service_1.searchService.advancedSearch(q, type, {
                category: category,
                faculty: faculty,
                minPrice: minPrice ? Number.parseFloat(minPrice) : undefined,
                maxPrice: maxPrice ? Number.parseFloat(maxPrice) : undefined,
                condition: condition,
            }, sortBy, Number.parseInt(page), Number.parseInt(limit));
            res.json({
                success: true,
                ...results
            });
        }
        catch (error) {
            console.error('Advanced Search Error:', error);
            res.status(500).json({ error: 'Failed to perform advanced search' });
        }
    }
};
