import { pgPool } from '../config/database';
import mongoose from 'mongoose';
import { Post } from '../models/mongoose/post.model';
import { Story } from '../models/mongoose/story.model';

async function checkSeededData() {
  try {
    console.log('🔍 Checking seeded data...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/raved', {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    console.log('✅ Connected to MongoDB');

    // Check users
    const userResult = await pgPool.query('SELECT COUNT(*) FROM users WHERE username LIKE \'mock_%\'');
    console.log(`👥 Mock users: ${userResult.rows[0].count}`);

    // Check admin user
    const adminResult = await pgPool.query('SELECT COUNT(*) FROM users WHERE username = \'admin\'');
    console.log(`👑 Admin users: ${adminResult.rows[0].count}`);

    // Check posts (MongoDB)
    const postCount = await Post.countDocuments({ deletedAt: null });
    console.log(`📝 Posts (MongoDB): ${postCount}`);

    // Check stories (MongoDB)
    const storyCount = await Story.countDocuments({ deletedAt: null });
    console.log(`📖 Stories (MongoDB): ${storyCount}`);

    // Check store items
    const storeResult = await pgPool.query('SELECT COUNT(*) FROM store_items');
    console.log(`🛍️ Store items: ${storeResult.rows[0].count}`);

    // Check connections
    const connectionResult = await pgPool.query('SELECT COUNT(*) FROM connections');
    console.log(`🤝 Connections: ${connectionResult.rows[0].count}`);

    // Check conversations
    const conversationResult = await pgPool.query('SELECT COUNT(*) FROM conversations');
    console.log(`💬 Conversations: ${conversationResult.rows[0].count}`);

    // Check events
    const eventResult = await pgPool.query('SELECT COUNT(*) FROM events');
    console.log(`📅 Events: ${eventResult.rows[0].count}`);

    // Check user scores
    const scoreResult = await pgPool.query('SELECT COUNT(*) FROM user_scores');
    console.log(`🏆 User scores: ${scoreResult.rows[0].count}`);

    console.log('✅ Data check completed');
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error checking data:', error);
  } finally {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  }
}

checkSeededData();