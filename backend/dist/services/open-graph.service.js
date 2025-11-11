"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenGraphService = void 0;
const database_1 = require("../config/database");
class OpenGraphService {
    // Generate Open Graph meta tags for different content types
    static async generateOpenGraphMeta(contentType, contentId, baseUrl = process.env.BASE_URL || 'https://yourapp.com') {
        const shareUrl = `${baseUrl}/share/${contentType}/${contentId}`;
        switch (contentType) {
            case 'post':
                return await this.generatePostOpenGraph(contentId, shareUrl);
            case 'profile':
                return await this.generateProfileOpenGraph(contentId, shareUrl);
            case 'event':
                return await this.generateEventOpenGraph(contentId, shareUrl);
            case 'product':
                return await this.generateProductOpenGraph(contentId, shareUrl);
            default:
                return this.generateDefaultOpenGraph(shareUrl);
        }
    }
    // Generate Open Graph for posts
    static async generatePostOpenGraph(contentId, shareUrl) {
        try {
            // Get post data from MongoDB (assuming Post model exists)
            const Post = (await Promise.resolve().then(() => __importStar(require('../models/mongoose/post.model')))).Post;
            const post = await Post.findById(contentId).populate('userId', 'username first_name last_name avatar_url');
            if (!post) {
                return this.generateDefaultOpenGraph(shareUrl);
            }
            // Get user data
            const user = post.userId;
            return {
                title: post.caption ? post.caption.substring(0, 60) + (post.caption.length > 60 ? '...' : '') : 'Post',
                description: `Posted by ${user.first_name} ${user.last_name}`,
                image: post.media && post.media.images && post.media.images.length > 0 ? post.media.images[0] : user.avatar_url || `${process.env.BASE_URL}/default-post-image.jpg`,
                url: shareUrl,
                type: 'article',
                siteName: this.DEFAULT_SITE_NAME,
                locale: this.DEFAULT_LOCALE,
                author: `${user.first_name} ${user.last_name}`,
                publishedTime: post.createdAt.toISOString(),
                modifiedTime: post.updatedAt.toISOString(),
                section: 'Social Feed',
                tags: post.tags || []
            };
        }
        catch (error) {
            console.error('Error generating post Open Graph:', error);
            return this.generateDefaultOpenGraph(shareUrl);
        }
    }
    // Generate Open Graph for profiles
    static async generateProfileOpenGraph(contentId, shareUrl) {
        try {
            // Get user data from PostgreSQL
            const query = `
        SELECT username, first_name, last_name, avatar_url, bio, faculty,
               followers_count, posts_count, created_at
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
      `;
            const result = await database_1.pgPool.query(query, [contentId]);
            if (result.rows.length === 0) {
                return this.generateDefaultOpenGraph(shareUrl);
            }
            const user = result.rows[0];
            return {
                title: `${user.first_name} ${user.last_name} (@${user.username})`,
                description: user.bio || `${user.first_name} has ${user.posts_count} posts and ${user.followers_count} followers. ${user.faculty ? `Studies ${user.faculty}.` : ''}`,
                image: user.avatar_url || `${process.env.BASE_URL}/default-avatar.jpg`,
                url: shareUrl,
                type: 'profile',
                siteName: this.DEFAULT_SITE_NAME,
                locale: this.DEFAULT_LOCALE,
                author: `${user.first_name} ${user.last_name}`,
                publishedTime: user.created_at.toISOString()
            };
        }
        catch (error) {
            console.error('Error generating profile Open Graph:', error);
            return this.generateDefaultOpenGraph(shareUrl);
        }
    }
    // Generate Open Graph for events
    static async generateEventOpenGraph(contentId, shareUrl) {
        try {
            // Get event data from PostgreSQL
            const query = `
        SELECT title, description, event_date, location, category,
               current_attendees, max_attendees, image_url, created_at
        FROM events
        WHERE id = $1 AND deleted_at IS NULL
      `;
            const result = await database_1.pgPool.query(query, [contentId]);
            if (result.rows.length === 0) {
                return this.generateDefaultOpenGraph(shareUrl);
            }
            const event = result.rows[0];
            return {
                title: event.title,
                description: `${event.description ? event.description.substring(0, 155) + (event.description.length > 155 ? '...' : '') : ''}\n📅 ${new Date(event.event_date).toLocaleDateString()}\n📍 ${event.location}\n👥 ${event.current_attendees}/${event.max_attendees || '∞'} attendees`,
                image: event.image_url || `${process.env.BASE_URL}/default-event-image.jpg`,
                url: shareUrl,
                type: 'event',
                siteName: this.DEFAULT_SITE_NAME,
                locale: this.DEFAULT_LOCALE,
                publishedTime: event.created_at.toISOString(),
                section: event.category
            };
        }
        catch (error) {
            console.error('Error generating event Open Graph:', error);
            return this.generateDefaultOpenGraph(shareUrl);
        }
    }
    // Generate Open Graph for products
    static async generateProductOpenGraph(contentId, shareUrl) {
        try {
            // Get product data from PostgreSQL
            const query = `
        SELECT name, description, price, category, condition, images,
               created_at
        FROM store_items
        WHERE id = $1 AND status = 'active' AND deleted_at IS NULL
      `;
            const result = await database_1.pgPool.query(query, [contentId]);
            if (result.rows.length === 0) {
                return this.generateDefaultOpenGraph(shareUrl);
            }
            const product = result.rows[0];
            return {
                title: `${product.name} - $${product.price}`,
                description: `${product.description ? product.description.substring(0, 155) + (product.description.length > 155 ? '...' : '') : ''}\nCategory: ${product.category}\nCondition: ${product.condition}`,
                image: product.images && product.images.length > 0 ? product.images[0] : `${process.env.BASE_URL}/default-product-image.jpg`,
                url: shareUrl,
                type: 'product',
                siteName: this.DEFAULT_SITE_NAME,
                locale: this.DEFAULT_LOCALE,
                publishedTime: product.created_at.toISOString(),
                section: product.category
            };
        }
        catch (error) {
            console.error('Error generating product Open Graph:', error);
            return this.generateDefaultOpenGraph(shareUrl);
        }
    }
    // Generate default Open Graph meta
    static generateDefaultOpenGraph(shareUrl) {
        return {
            title: 'Check this out!',
            description: 'Shared from our app',
            image: `${process.env.BASE_URL}/default-share-image.jpg`,
            url: shareUrl,
            type: 'website',
            siteName: this.DEFAULT_SITE_NAME,
            locale: this.DEFAULT_LOCALE
        };
    }
    // Generate HTML meta tags string
    static generateMetaTagsHtml(meta) {
        const tags = [
            // Basic meta tags
            `<meta property="og:title" content="${this.escapeHtml(meta.title)}" />`,
            `<meta property="og:description" content="${this.escapeHtml(meta.description)}" />`,
            `<meta property="og:image" content="${meta.image}" />`,
            `<meta property="og:url" content="${meta.url}" />`,
            `<meta property="og:type" content="${meta.type}" />`,
            `<meta property="og:site_name" content="${this.escapeHtml(meta.siteName)}" />`,
            // Twitter Card tags
            `<meta name="twitter:card" content="summary_large_image" />`,
            `<meta name="twitter:title" content="${this.escapeHtml(meta.title)}" />`,
            `<meta name="twitter:description" content="${this.escapeHtml(meta.description)}" />`,
            `<meta name="twitter:image" content="${meta.image}" />`,
            // Additional Open Graph tags
            meta.locale ? `<meta property="og:locale" content="${meta.locale}" />` : '',
            meta.author ? `<meta property="article:author" content="${this.escapeHtml(meta.author)}" />` : '',
            meta.publishedTime ? `<meta property="article:published_time" content="${meta.publishedTime}" />` : '',
            meta.modifiedTime ? `<meta property="article:modified_time" content="${meta.modifiedTime}" />` : '',
            meta.section ? `<meta property="article:section" content="${this.escapeHtml(meta.section)}" />` : '',
            // Tags
            ...(meta.tags || []).map(tag => `<meta property="article:tag" content="${this.escapeHtml(tag)}" />`)
        ].filter(tag => tag !== '');
        return tags.join('\n    ');
    }
    // Generate JSON-LD structured data
    static generateStructuredData(meta) {
        const structuredData = {
            '@context': 'https://schema.org',
            '@type': this.getSchemaType(meta.type),
            name: meta.title,
            description: meta.description,
            image: meta.image,
            url: meta.url
        };
        // Add type-specific properties
        switch (meta.type) {
            case 'article':
                if (meta.author)
                    structuredData.author = { '@type': 'Person', name: meta.author };
                if (meta.publishedTime)
                    structuredData.datePublished = meta.publishedTime;
                if (meta.modifiedTime)
                    structuredData.dateModified = meta.modifiedTime;
                break;
            case 'profile':
                structuredData['@type'] = 'Person';
                if (meta.author)
                    structuredData.name = meta.author;
                break;
            case 'event':
                structuredData['@type'] = 'Event';
                break;
            case 'product':
                structuredData['@type'] = 'Product';
                break;
        }
        return `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`;
    }
    // Get Schema.org type from Open Graph type
    static getSchemaType(ogType) {
        const typeMap = {
            'article': 'Article',
            'profile': 'Person',
            'event': 'Event',
            'product': 'Product',
            'website': 'WebSite'
        };
        return typeMap[ogType] || 'WebSite';
    }
    // Escape HTML entities
    static escapeHtml(text) {
        const htmlEntities = {
            '&': '&',
            '<': '<',
            '>': '>',
            '"': '"',
            "'": '&#x27;'
        };
        return text.replace(/[&<>"']/g, char => htmlEntities[char]);
    }
    // Cache Open Graph meta data
    static async cacheOpenGraphMeta(contentType, contentId, meta) {
        const cacheKey = `og:${contentType}:${contentId}`;
        const cacheValue = JSON.stringify(meta);
        // Cache for 1 hour
        await (await Promise.resolve().then(() => __importStar(require('../config/database')))).redis.setex(cacheKey, 3600, cacheValue);
    }
    // Get cached Open Graph meta data
    static async getCachedOpenGraphMeta(contentType, contentId) {
        const cacheKey = `og:${contentType}:${contentId}`;
        const cached = await (await Promise.resolve().then(() => __importStar(require('../config/database')))).redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        return null;
    }
    // Generate complete HTML head section for sharing
    static async generateShareHtml(contentType, contentId) {
        const meta = await this.generateOpenGraphMeta(contentType, contentId);
        const metaTags = this.generateMetaTagsHtml(meta);
        const structuredData = this.generateStructuredData(meta);
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(meta.title)}</title>
    ${metaTags}
    ${structuredData}
</head>
<body>
    <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
        <h1>${this.escapeHtml(meta.title)}</h1>
        <p>${this.escapeHtml(meta.description)}</p>
        <img src="${meta.image}" alt="${this.escapeHtml(meta.title)}" style="max-width: 100%; height: auto; margin: 20px 0;" />
        <p><a href="${meta.url}">View on ${meta.siteName}</a></p>
    </div>
</body>
</html>`;
    }
}
exports.OpenGraphService = OpenGraphService;
OpenGraphService.DEFAULT_SITE_NAME = 'Your App';
OpenGraphService.DEFAULT_LOCALE = 'en_US';
exports.default = OpenGraphService;
