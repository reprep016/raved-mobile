"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = exports.connectDB = exports.pgPool = void 0;
exports.initializePostgresSchema = initializePostgresSchema;
const mongoose_1 = __importDefault(require("mongoose"));
const pg_1 = require("pg");
const ioredis_1 = __importDefault(require("ioredis"));
const index_1 = require("./index");
// PostgreSQL Connection Pool
exports.pgPool = new pg_1.Pool({
    connectionString: index_1.CONFIG.POSTGRES_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});
// MongoDB Connection
const connectDB = async () => {
    try {
        await mongoose_1.default.connect(index_1.CONFIG.MONGODB_URL, {});
        console.log('✅ MongoDB Connected');
    }
    catch (err) {
        console.error('❌ MongoDB Error:', err);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
// Redis Connection
// Make Redis connection resilient to transient DNS/network errors
exports.redis = new ioredis_1.default(index_1.CONFIG.REDIS_URL, {
    // exponential backoff up to 2s
    retryStrategy: (times) => Math.min(times * 50, 2000),
    // reconnect on certain network errors
    reconnectOnError: (err) => {
        if (!err)
            return false;
        const codes = ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET'];
        return codes.includes(err.code);
    },
    // allow unlimited retries per request (avoid immediate errors while reconnecting)
    maxRetriesPerRequest: null,
    enableOfflineQueue: true,
});
exports.redis.on('connect', () => console.log('✅ Redis Connected'));
exports.redis.on('error', (err) => console.error('❌ Redis Error:', err));
async function initializePostgresSchema() {
    const client = await exports.pgPool.connect();
    try {
        await client.query('BEGIN');
        // Users Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        faculty VARCHAR(100),
        university VARCHAR(255),
        student_id VARCHAR(50),
        location VARCHAR(255),
        website VARCHAR(255),
        
        -- Verification
        email_verified BOOLEAN DEFAULT FALSE,
        phone_verified BOOLEAN DEFAULT FALSE,
        
        -- Privacy Settings
        is_private BOOLEAN DEFAULT FALSE,
        show_activity BOOLEAN DEFAULT TRUE,
        read_receipts BOOLEAN DEFAULT TRUE,
        allow_downloads BOOLEAN DEFAULT FALSE,
        allow_story_sharing BOOLEAN DEFAULT TRUE,
        
        -- Stats
        followers_count INTEGER DEFAULT 0,
        following_count INTEGER DEFAULT 0,
        posts_count INTEGER DEFAULT 0,
        
        -- Subscription
        subscription_tier VARCHAR(20) DEFAULT 'free',
        subscription_expires_at TIMESTAMP,
        trial_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP,
        
        -- Soft Delete
        deleted_at TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_tier);
    `);
        // Connections/Follows Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
        following_id UUID REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'following',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_connections_follower ON connections(follower_id);
      CREATE INDEX IF NOT EXISTS idx_connections_following ON connections(following_id);
    `);
        // Conversations Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        participant1_id UUID REFERENCES users(id) ON DELETE CASCADE,
        participant2_id UUID REFERENCES users(id) ON DELETE CASCADE,
        last_message_id VARCHAR(255),
        last_message_at TIMESTAMP,
        unread_count1 INTEGER DEFAULT 0,
        unread_count2 INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        UNIQUE(participant1_id, participant2_id),
        CHECK (participant1_id < participant2_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_conversations_participant1 ON conversations(participant1_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_participant2 ON conversations(participant2_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conversations_deleted ON conversations(deleted_at);
    `);
        // Messages Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(deleted_at);
    `);
        // Events Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organizer_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        event_date DATE NOT NULL,
        event_time TIME NOT NULL,
        location VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        audience VARCHAR(50) DEFAULT 'all',
        max_attendees INTEGER DEFAULT 100,
        current_attendees INTEGER DEFAULT 0,
        registration_fee DECIMAL(10,2) DEFAULT 0.00,
        image_url TEXT,
        
        -- Settings
        require_registration BOOLEAN DEFAULT TRUE,
        allow_waitlist BOOLEAN DEFAULT TRUE,
        send_reminders BOOLEAN DEFAULT TRUE,
        
        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
      CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
    `);
        // Event Attendees
        await client.query(`
      CREATE TABLE IF NOT EXISTS event_attendees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID REFERENCES events(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'attending',
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(event_id, user_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
      CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees(user_id);
    `);
        // Store Items Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS store_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        original_price DECIMAL(10,2),
        category VARCHAR(50) NOT NULL,
        condition VARCHAR(50) NOT NULL,
        size VARCHAR(20),
        brand VARCHAR(100),
        color VARCHAR(50),
        material VARCHAR(100),
        
        -- Media
        images TEXT[], -- Array of image URLs
        
        -- Stats
        views_count INTEGER DEFAULT 0,
        likes_count INTEGER DEFAULT 0,
        saves_count INTEGER DEFAULT 0,
        sales_count INTEGER DEFAULT 0,
        
        -- Status
        status VARCHAR(20) DEFAULT 'active',
        
        -- Payment Options
        payment_methods TEXT[], -- ['momo', 'cash', 'bank']
        meetup_location VARCHAR(255),
        seller_phone VARCHAR(20),
        
        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_store_items_seller ON store_items(seller_id);
      CREATE INDEX IF NOT EXISTS idx_store_items_category ON store_items(category);
      CREATE INDEX IF NOT EXISTS idx_store_items_status ON store_items(status);
    `);
        // Orders Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        buyer_id UUID REFERENCES users(id),
        seller_id UUID REFERENCES users(id),
        item_id UUID REFERENCES store_items(id),
        
        -- Order Details
        quantity INTEGER DEFAULT 1,
        total_amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        delivery_method VARCHAR(50) NOT NULL,
        delivery_address TEXT,
        buyer_phone VARCHAR(20),
        
        -- Status
        status VARCHAR(50) DEFAULT 'pending',
        payment_status VARCHAR(50) DEFAULT 'pending',
        
        -- Payment Reference
        payment_reference VARCHAR(255) UNIQUE,
        
        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    `);
        // Subscriptions/Payments Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        plan_type VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        payment_reference VARCHAR(255) UNIQUE,
        status VARCHAR(50) DEFAULT 'active',
        starts_at TIMESTAMP NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
    `);
        // User Rankings/Scores Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS user_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        weekly_score INTEGER DEFAULT 0,
        monthly_score INTEGER DEFAULT 0,
        all_time_score INTEGER DEFAULT 0,
        
        -- Activity Stats
        total_likes_received INTEGER DEFAULT 0,
        total_comments_received INTEGER DEFAULT 0,
        total_shares_received INTEGER DEFAULT 0,
        total_sales INTEGER DEFAULT 0,
        total_features INTEGER DEFAULT 0,
        
        -- Reset Timestamps
        last_weekly_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_monthly_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_scores_weekly ON user_scores(weekly_score DESC);
      CREATE INDEX IF NOT EXISTS idx_user_scores_monthly ON user_scores(monthly_score DESC);
    `);
        // Ranking History Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ranking_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        ranking_period VARCHAR(50) NOT NULL, -- e.g., 'weekly-2023-10-26', 'monthly-2023-10'
        rank INTEGER NOT NULL,
        score INTEGER NOT NULL,
        ranking_type VARCHAR(20) NOT NULL, -- 'weekly', 'monthly'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, ranking_period, ranking_type)
      );
      CREATE INDEX IF NOT EXISTS idx_ranking_history_user ON ranking_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_ranking_history_period ON ranking_history(ranking_period);
    `);
        // Ranking Prizes Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ranking_prizes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        ranking_period VARCHAR(50) NOT NULL,
        rank INTEGER NOT NULL,
        prize_amount DECIMAL(10,2) NOT NULL,
        prize_type VARCHAR(20) NOT NULL,
        awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ranking_prizes_user ON ranking_prizes(user_id);
      CREATE INDEX IF NOT EXISTS idx_ranking_prizes_period ON ranking_prizes(ranking_period);
    `);
        // Posts Table (MongoDB equivalent in PostgreSQL)
        await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('image', 'video', 'carousel', 'text')),
        caption TEXT,
        media JSONB DEFAULT '{}',
        location VARCHAR(255),
        tags TEXT[] DEFAULT '{}',
        brand VARCHAR(100),
        occasion VARCHAR(100),
        visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'faculty', 'connections', 'private')),
        is_for_sale BOOLEAN DEFAULT FALSE,
        sale_details JSONB DEFAULT '{}',
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        shares_count INTEGER DEFAULT 0,
        saves_count INTEGER DEFAULT 0,
        views_count INTEGER DEFAULT 0,
        is_featured BOOLEAN DEFAULT FALSE,
        featured_at TIMESTAMP,
        faculty VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
      CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility);
      CREATE INDEX IF NOT EXISTS idx_posts_faculty ON posts(faculty);
      CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_is_featured ON posts(is_featured, created_at DESC);
    `);
        // Comments Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        likes_count INTEGER DEFAULT 0,
        replies_count INTEGER DEFAULT 0,
        parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
      CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
      CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);
    `);
        // Likes Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
        comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('post', 'comment')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, post_id),
        UNIQUE(user_id, comment_id)
      );

      CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
      CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
      CREATE INDEX IF NOT EXISTS idx_likes_comment ON likes(comment_id);
    `);
        // Stories Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS stories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('image', 'video')),
        media JSONB DEFAULT '{}',
        caption TEXT,
        location VARCHAR(255),
        views_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id);
      CREATE INDEX IF NOT EXISTS idx_stories_created ON stories(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);
    `);
        // Theme preferences
        await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(50) DEFAULT 'default';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS dark_mode_preference BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_two_factor_enabled BOOLEAN DEFAULT FALSE;
    `);
        // Blocked users
        await client.query(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
        blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(blocker_id, blocked_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);
      CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);
    `);
        // Shopping cart
        await client.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        item_id UUID REFERENCES store_items(id) ON DELETE CASCADE,
        quantity INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, item_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);
    `);
        // Wishlist/saved items
        await client.query(`
      CREATE TABLE IF NOT EXISTS saved_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        item_id UUID REFERENCES store_items(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, item_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_saved_items_user ON saved_items(user_id);
    `);
        // Add subscription code to subscriptions table
        await client.query(`
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS subscription_code VARCHAR(255);
    `);
        // Device Tokens Table for Push Notifications
        await client.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
        device_id VARCHAR(255),
        app_version VARCHAR(50),
        active BOOLEAN DEFAULT TRUE,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, token)
      );

      CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(active);
      CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON device_tokens(platform);
    `);
        // Notification Settings Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email_notifications BOOLEAN DEFAULT TRUE,
        push_notifications BOOLEAN DEFAULT TRUE,
        likes_notifications BOOLEAN DEFAULT TRUE,
        comments_notifications BOOLEAN DEFAULT TRUE,
        follows_notifications BOOLEAN DEFAULT TRUE,
        events_notifications BOOLEAN DEFAULT TRUE,
        messages_notifications BOOLEAN DEFAULT TRUE,
        marketing_notifications BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Email Verification Tokens Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires ON email_verification_tokens(expires_at);
    `);
        // Password Reset Tokens Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
    `);
        // Notifications Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB DEFAULT '{}',
        actor_id UUID REFERENCES users(id),
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
    `);
        // Analytics Events Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        session_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        event_category VARCHAR(100) NOT NULL,
        event_action VARCHAR(100) NOT NULL,
        event_label VARCHAR(255),
        event_value INTEGER,
        page_url TEXT,
        page_title VARCHAR(255),
        referrer TEXT,
        user_agent TEXT,
        ip_address INET,
        device_type VARCHAR(50),
        browser VARCHAR(100),
        os VARCHAR(100),
        screen_resolution VARCHAR(20),
        viewport_size VARCHAR(20),
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_category ON analytics_events(event_category);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp DESC);
    `);
        // Analytics Metrics Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_name VARCHAR(255) NOT NULL,
        metric_value DECIMAL(20,6) NOT NULL,
        metric_type VARCHAR(20) NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'histogram')),
        tags JSONB DEFAULT '{}',
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_analytics_metrics_name ON analytics_metrics(metric_name);
      CREATE INDEX IF NOT EXISTS idx_analytics_metrics_type ON analytics_metrics(metric_type);
      CREATE INDEX IF NOT EXISTS idx_analytics_metrics_timestamp ON analytics_metrics(timestamp DESC);
    `);
        // Analytics Reports Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'custom')),
        report_name VARCHAR(255) NOT NULL,
        date_range_start TIMESTAMP NOT NULL,
        date_range_end TIMESTAMP NOT NULL,
        data JSONB DEFAULT '{}',
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_analytics_reports_type ON analytics_reports(report_type);
      CREATE INDEX IF NOT EXISTS idx_analytics_reports_generated ON analytics_reports(generated_at DESC);
    `);
        // User Activity Logs Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS user_activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        activity_type VARCHAR(100) NOT NULL,
        activity_data JSONB DEFAULT '{}',
        ip_address INET,
        user_agent TEXT,
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user ON user_activity_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_activity_logs_type ON user_activity_logs(activity_type);
      CREATE INDEX IF NOT EXISTS idx_user_activity_logs_timestamp ON user_activity_logs(timestamp DESC);
    `);
        // A/B Tests Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ab_tests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_name VARCHAR(255) NOT NULL UNIQUE,
        test_description TEXT,
        feature_name VARCHAR(255) NOT NULL,
        variants TEXT[] NOT NULL,
        weights DECIMAL(5,4)[],
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_ab_tests_name ON ab_tests(test_name);
      CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
      CREATE INDEX IF NOT EXISTS idx_ab_tests_feature ON ab_tests(feature_name);
    `);
        // A/B Test Variants Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ab_test_variants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES ab_tests(id) ON DELETE CASCADE,
        variant_name VARCHAR(255) NOT NULL,
        variant_value TEXT NOT NULL,
        weight DECIMAL(5,4) NOT NULL DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(test_id, variant_name)
      );

      CREATE INDEX IF NOT EXISTS idx_ab_test_variants_test ON ab_test_variants(test_id);
    `);
        // A/B Test Results Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ab_test_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id UUID REFERENCES ab_tests(id) ON DELETE CASCADE,
        variant_name VARCHAR(255) NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        event_value DECIMAL(20,6),
        timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_ab_test_results_test ON ab_test_results(test_id);
      CREATE INDEX IF NOT EXISTS idx_ab_test_results_user ON ab_test_results(user_id);
      CREATE INDEX IF NOT EXISTS idx_ab_test_results_variant ON ab_test_results(variant_name);
      CREATE INDEX IF NOT EXISTS idx_ab_test_results_timestamp ON ab_test_results(timestamp DESC);
    `);
        // User Trust Scores Table for Content Moderation
        await client.query(`
      CREATE TABLE IF NOT EXISTS user_trust_scores (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        trust_score INTEGER NOT NULL DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),
        total_posts INTEGER DEFAULT 0,
        flagged_posts INTEGER DEFAULT 0,
        total_comments INTEGER DEFAULT 0,
        flagged_comments INTEGER DEFAULT 0,
        total_messages INTEGER DEFAULT 0,
        flagged_messages INTEGER DEFAULT 0,
        violations_count INTEGER DEFAULT 0,
        last_violation_date TIMESTAMP,
        account_age_days INTEGER DEFAULT 0,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_user_trust_scores_user ON user_trust_scores(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_trust_scores_score ON user_trust_scores(trust_score DESC);
    `);
        // Story Views Table for Stories
        await client.query(`
       CREATE TABLE IF NOT EXISTS story_views (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         story_id VARCHAR(255) NOT NULL,
         user_id UUID REFERENCES users(id) ON DELETE CASCADE,
         viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         UNIQUE(story_id, user_id)
       );

       CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id);
       CREATE INDEX IF NOT EXISTS idx_story_views_user ON story_views(user_id);
     `);
        // Shares Table
        await client.query(`
       CREATE TABLE IF NOT EXISTS shares (
         id SERIAL PRIMARY KEY,
         content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('post', 'profile', 'event', 'product')),
         content_id VARCHAR(255) NOT NULL,
         user_id UUID REFERENCES users(id) ON DELETE CASCADE,
         platform VARCHAR(20) NOT NULL CHECK (platform IN ('facebook', 'twitter', 'instagram', 'whatsapp', 'native', 'link')),
         share_url TEXT NOT NULL,
         referral_code VARCHAR(255),
         metadata JSONB DEFAULT '{}',
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );

       CREATE INDEX IF NOT EXISTS idx_shares_content ON shares(content_type, content_id);
       CREATE INDEX IF NOT EXISTS idx_shares_user ON shares(user_id);
       CREATE INDEX IF NOT EXISTS idx_shares_platform ON shares(platform);
       CREATE INDEX IF NOT EXISTS idx_shares_referral ON shares(referral_code);
       CREATE INDEX IF NOT EXISTS idx_shares_created ON shares(created_at);
     `);
        // Share Analytics Table
        await client.query(`
       CREATE TABLE IF NOT EXISTS share_analytics (
         id SERIAL PRIMARY KEY,
         share_id INTEGER REFERENCES shares(id) ON DELETE CASCADE,
         user_agent TEXT,
         ip_address INET,
         clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );

       CREATE INDEX IF NOT EXISTS idx_share_analytics_share ON share_analytics(share_id);
       CREATE INDEX IF NOT EXISTS idx_share_analytics_clicked ON share_analytics(clicked_at);
     `);
        // Referrals Table
        await client.query(`
       CREATE TABLE IF NOT EXISTS referrals (
         id SERIAL PRIMARY KEY,
         referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
         referred_id UUID REFERENCES users(id) ON DELETE CASCADE,
         referral_code VARCHAR(255) NOT NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         UNIQUE(referrer_id, referred_id)
       );

       CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
       CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
       CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
     `);
        // Share Analytics Events Table
        await client.query(`
       CREATE TABLE IF NOT EXISTS share_analytics_events (
         id SERIAL PRIMARY KEY,
         share_id INTEGER REFERENCES shares(id) ON DELETE CASCADE,
         event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('click', 'view', 'conversion')),
         user_id UUID REFERENCES users(id),
         metadata JSONB DEFAULT '{}',
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );

       CREATE INDEX IF NOT EXISTS idx_share_analytics_events_share ON share_analytics_events(share_id);
       CREATE INDEX IF NOT EXISTS idx_share_analytics_events_type ON share_analytics_events(event_type);
       CREATE INDEX IF NOT EXISTS idx_share_analytics_events_user ON share_analytics_events(user_id);
       CREATE INDEX IF NOT EXISTS idx_share_analytics_events_created ON share_analytics_events(created_at);
     `);
        // Share Templates Table
        await client.query(`
       CREATE TABLE IF NOT EXISTS share_templates (
         id SERIAL PRIMARY KEY,
         content_type VARCHAR(50) NOT NULL,
         platform VARCHAR(50) NOT NULL,
         template TEXT NOT NULL,
         variables TEXT[] DEFAULT '{}',
         is_default BOOLEAN DEFAULT FALSE,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         UNIQUE(content_type, platform, is_default)
       );

       CREATE INDEX IF NOT EXISTS idx_share_templates_content ON share_templates(content_type);
       CREATE INDEX IF NOT EXISTS idx_share_templates_platform ON share_templates(platform);
       CREATE INDEX IF NOT EXISTS idx_share_templates_default ON share_templates(is_default);
     `);
        // Deep Links Table
        await client.query(`
       CREATE TABLE IF NOT EXISTS deep_links (
         id SERIAL PRIMARY KEY,
         content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('post', 'profile', 'event', 'product')),
         content_id VARCHAR(255) NOT NULL,
         short_code VARCHAR(20) UNIQUE NOT NULL,
         long_url TEXT NOT NULL,
         platform VARCHAR(20),
         campaign VARCHAR(100),
         metadata JSONB DEFAULT '{}',
         click_count INTEGER DEFAULT 0,
         last_clicked_at TIMESTAMP,
         expires_at TIMESTAMP,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );

       CREATE INDEX IF NOT EXISTS idx_deep_links_content ON deep_links(content_type, content_id);
       CREATE INDEX IF NOT EXISTS idx_deep_links_short_code ON deep_links(short_code);
       CREATE INDEX IF NOT EXISTS idx_deep_links_expires ON deep_links(expires_at);
       CREATE INDEX IF NOT EXISTS idx_deep_links_clicks ON deep_links(click_count DESC);
     `);
        // Deep Link Clicks Table
        await client.query(`
       CREATE TABLE IF NOT EXISTS deep_link_clicks (
         id SERIAL PRIMARY KEY,
         deep_link_id INTEGER REFERENCES deep_links(id) ON DELETE CASCADE,
         user_agent TEXT,
         ip_address INET,
         referrer TEXT,
         clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );

       CREATE INDEX IF NOT EXISTS idx_deep_link_clicks_link ON deep_link_clicks(deep_link_id);
       CREATE INDEX IF NOT EXISTS idx_deep_link_clicks_time ON deep_link_clicks(clicked_at DESC);
     `);
        // Offline Queues Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS offline_queues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        request_type VARCHAR(50) NOT NULL,
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        data JSONB DEFAULT '{}',
        status VARCHAR(20) DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_offline_queues_user ON offline_queues(user_id);
      CREATE INDEX IF NOT EXISTS idx_offline_queues_status ON offline_queues(status);
      CREATE INDEX IF NOT EXISTS idx_offline_queues_created ON offline_queues(created_at);
    `);
        // Offline Data Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS offline_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        resource_type VARCHAR(50) NOT NULL,
        resource_id VARCHAR(255) NOT NULL,
        data JSONB DEFAULT '{}',
        sync_status VARCHAR(20) DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_offline_data_user ON offline_data(user_id);
      CREATE INDEX IF NOT EXISTS idx_offline_data_resource ON offline_data(resource_type, resource_id);
      CREATE INDEX IF NOT EXISTS idx_offline_data_synced ON offline_data(last_synced_at);
      CREATE INDEX IF NOT EXISTS idx_offline_data_status ON offline_data(sync_status);
    `);
        await client.query('COMMIT');
        console.log('✅ PostgreSQL Schema Initialized');
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ PostgreSQL Schema Error:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
