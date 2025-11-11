import { pgPool, initializePostgresSchema } from '../config/database';
import { CONFIG } from '../config';

async function initializeDatabase() {
  try {
    console.log('🚀 Initializing database...');

    // Initialize PostgreSQL schema
    await initializePostgresSchema();
    console.log('✅ PostgreSQL schema initialized');

    // Create indexes for better performance
    await createIndexes();
    console.log('✅ Database indexes created');

    // Seed initial data
    await seedInitialData();
    console.log('✅ Initial data seeded');

    console.log('🎉 Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

async function createIndexes() {
  const indexes = [
    // Users table indexes
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
    'CREATE INDEX IF NOT EXISTS idx_users_faculty ON users(faculty)',
    'CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier)',

    // Posts table indexes
    'CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility)',
    'CREATE INDEX IF NOT EXISTS idx_posts_faculty ON posts(faculty)',
    'CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)',

    // Connections table indexes
    'CREATE INDEX IF NOT EXISTS idx_connections_follower_id ON connections(follower_id)',
    'CREATE INDEX IF NOT EXISTS idx_connections_following_id ON connections(following_id)',
    'CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status)',

    // Store items indexes
    'CREATE INDEX IF NOT EXISTS idx_store_items_seller_id ON store_items(seller_id)',
    'CREATE INDEX IF NOT EXISTS idx_store_items_category ON store_items(category)',
    'CREATE INDEX IF NOT EXISTS idx_store_items_status ON store_items(status)',
    'CREATE INDEX IF NOT EXISTS idx_store_items_price ON store_items(price)',

    // Events indexes
    'CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events(organizer_id)',
    'CREATE INDEX IF NOT EXISTS idx_events_category ON events(category)',
    'CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date)',
    'CREATE INDEX IF NOT EXISTS idx_events_audience ON events(audience)',

    // Notifications indexes
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)',

    // Messages indexes
    'CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC)',
  ];

  for (const indexQuery of indexes) {
    try {
      await pgPool.query(indexQuery);
    } catch (error) {
      console.warn(`Warning: Failed to create index: ${indexQuery}`, error);
    }
  }
}

async function seedInitialData() {
  try {
    // Check if data already exists
    const userCount = await pgPool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) > 0) {
      console.log('📋 Initial data already exists, skipping seeding');
      return;
    }

    console.log('🌱 Seeding initial data...');

    // Ensure role column exists
    await pgPool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
    `);

    // Create admin user
    const { hashPassword } = await import('../utils/auth.utils');
    const adminPassword = await hashPassword('admin123');
    await pgPool.query(`
      INSERT INTO users (
        username, email, phone, password_hash,
        first_name, last_name, faculty, university,
        email_verified, phone_verified, role, subscription_tier
      ) VALUES (
        'admin', 'admin@raved.app', '+233123456789', $1,
        'System', 'Administrator', 'Administration', 'Raved University',
        true, true, 'admin', 'premium'
      )
      ON CONFLICT (username) DO UPDATE SET
        role = 'admin',
        subscription_tier = 'premium',
        updated_at = CURRENT_TIMESTAMP
    `, [adminPassword]);

    // Initialize trust score for admin
    await pgPool.query(`
      INSERT INTO user_trust_scores (
        user_id, trust_score, account_age_days, is_verified, created_at, updated_at
      ) VALUES (
        (SELECT id FROM users WHERE username = 'admin'), 100, 365, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id) DO NOTHING
    `);

    // Create sample faculties
    const faculties = [
      'Computer Science', 'Business Administration', 'Engineering',
      'Arts & Humanities', 'Science', 'Medicine', 'Law', 'Education'
    ];

    // Create sample categories for store and events
    const storeCategories = [
      'clothing', 'shoes', 'accessories', 'bags', 'jewelry', 'electronics', 'books', 'other'
    ];

    const eventCategories = [
      'academic', 'social', 'sports', 'cultural', 'networking', 'career', 'other'
    ];

    console.log('✅ Initial data seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding initial data:', error);
    throw error;
  }
}

// Run initialization if this script is executed directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('🏁 Database initialization script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database initialization script failed:', error);
      process.exit(1);
    });
}

export { initializeDatabase };
