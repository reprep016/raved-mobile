"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedMockData = seedMockData;
const database_1 = require("../config/database");
const auth_utils_1 = require("../utils/auth.utils");
const mongoose_1 = __importDefault(require("mongoose"));
const post_model_1 = require("../models/mongoose/post.model");
const story_model_1 = require("../models/mongoose/story.model");
// Mock data definitions (copied from frontend to avoid import issues)
const mockUsers = [
    { id: 'u1', name: 'Sophie Parker', avatar: 'https://i.imgur.com/bxfE9TV.jpg', faculty: 'Science' },
    { id: 'u2', name: 'Emily White', avatar: 'https://i.imgur.com/nV6fsQh.jpg', faculty: 'Arts' },
    { id: 'u3', name: 'Marcus Stevens', avatar: 'https://i.imgur.com/IigY4Hm.jpg', faculty: 'Business' },
    { id: 'u4', name: 'Anna Reynolds', avatar: 'https://i.imgur.com/KnZQY6W.jpg', faculty: 'Medicine' },
    { id: 'u5', name: 'David Chen', avatar: 'https://i.imgur.com/kMB0Upu.jpg', faculty: 'Engineering' },
    { id: 'u6', name: 'Jason Miller', avatar: 'https://i.imgur.com/8Km9tLL.jpg', faculty: 'Law' },
];
const mockImages = [
    'https://i.imgur.com/Ynh9LMX.jpg',
    'https://i.imgur.com/D3CYJcL.jpg',
    'https://i.imgur.com/JObkVPV.jpg',
    'https://i.imgur.com/KnZQY6W.jpg',
    'https://i.imgur.com/IigY4Hm.jpg',
    'https://i.imgur.com/nV6fsQh.jpg',
];
const mockVideos = [
    'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
    'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4',
    'https://file-examples.com/storage/fe86c86b8b66f8e0b2b9b3b/2017/10/file_example_MP4_480_1_5MG.mp4',
];
const mockCaptions = [
    "Perfect outfit for today's presentation! 💼 #CampusStyle",
    'Sustainable fashion vibes 🌿 #EcoFriendly',
    'Weekend casuals ✨ #Relaxed',
    'Library chic 📚 #AcademicFashion',
    'Date night look 💕 #Elegant',
    'Comfort meets style 😊 #CampusLife',
    'Bold colors today 🎨 #Creative',
    'Vintage vibes 🎭 #VintageStyle',
];
const mockStoreItems = [
    {
        id: 'item_1',
        name: 'Eco-Friendly Dress',
        description: 'Sustainable fashion dress in excellent condition',
        price: 45,
        originalPrice: 60,
        images: [mockImages[0]],
        category: 'clothing',
        condition: 'like-new',
        size: 'M',
        brand: 'Zara',
        seller: {
            id: 'u1',
            name: 'Sophie Parker',
            avatar: 'https://i.imgur.com/bxfE9TV.jpg',
            faculty: 'Science',
            phone: '+233501234567'
        },
        stats: { likes: 24, views: 156, saves: 8 },
        paymentMethods: ['Mobile Money', 'Cash'],
        meetupLocation: 'Campus Library',
        timestamp: Date.now() - 86400000,
        tags: ['sale']
    },
    {
        id: 'item_2',
        name: 'Business Jacket',
        description: 'Professional business jacket, perfect for presentations',
        price: 89,
        originalPrice: undefined,
        images: [mockImages[1]],
        category: 'clothing',
        condition: 'new',
        size: 'L',
        brand: 'H&M',
        seller: {
            id: 'u3',
            name: 'Marcus Stevens',
            avatar: 'https://i.imgur.com/IigY4Hm.jpg',
            faculty: 'Business',
            phone: '+233501234568'
        },
        stats: { likes: 45, views: 234, saves: 12 },
        paymentMethods: ['Mobile Money', 'Cash', 'Bank Transfer'],
        meetupLocation: 'Student Union Building',
        timestamp: Date.now() - 172800000,
        tags: []
    },
    {
        id: 'item_3',
        name: 'Artistic Blouse',
        description: 'Unique vintage-style blouse',
        price: 32,
        originalPrice: undefined,
        images: [mockImages[2]],
        category: 'clothing',
        condition: 'good',
        size: 'S',
        brand: 'Vintage',
        seller: {
            id: 'u2',
            name: 'Emily White',
            avatar: 'https://i.imgur.com/nV6fsQh.jpg',
            faculty: 'Arts',
            phone: '+233501234569'
        },
        stats: { likes: 18, views: 98, saves: 5 },
        paymentMethods: ['Cash'],
        meetupLocation: 'Main Gate',
        timestamp: Date.now() - 259200000,
        tags: []
    },
    {
        id: 'item_4',
        name: 'Medical Scrubs',
        description: 'Comfortable medical scrubs for clinical rotations',
        price: 28,
        originalPrice: undefined,
        images: [mockImages[3]],
        category: 'clothing',
        condition: 'new',
        size: 'M',
        brand: 'Generic',
        seller: {
            id: 'u4',
            name: 'Anna Reynolds',
            avatar: 'https://i.imgur.com/KnZQY6W.jpg',
            faculty: 'Medicine',
            phone: '+233501234570'
        },
        stats: { likes: 12, views: 67, saves: 3 },
        paymentMethods: ['Mobile Money', 'Cash'],
        meetupLocation: 'Faculty Building',
        timestamp: Date.now() - 345600000,
        tags: ['hot']
    },
];
// Mock data seeding script
async function seedMockData() {
    try {
        console.log('🌱 Starting mock data seeding...');
        // Connect to MongoDB
        await mongoose_1.default.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/raved', {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        console.log('✅ Connected to MongoDB for seeding');
        // Check if mock data already exists - force reseed for now
        // const userCount = await pgPool.query('SELECT COUNT(*) FROM users WHERE username LIKE \'mock_%\'');
        // if (parseInt(userCount.rows[0].count) > 0) {
        //   console.log('📋 Mock data already exists, skipping seeding');
        //   return;
        // }
        // Seed users
        console.log('👥 Seeding mock users...');
        await seedUsers();
        // Seed connections/follows
        console.log('🤝 Seeding connections...');
        await seedConnections();
        // Seed posts
        console.log('📝 Seeding posts...');
        await seedPosts();
        // Seed stories
        console.log('📖 Seeding stories...');
        await seedStories();
        // Seed store items
        console.log('🛍️ Seeding store items...');
        await seedStoreItems();
        // Seed events
        console.log('📅 Seeding events...');
        await seedEvents();
        // Seed conversations and messages
        console.log('💬 Seeding conversations...');
        await seedConversations();
        // Seed user scores for rankings
        console.log('🏆 Seeding user scores...');
        await seedUserScores();
        console.log('✅ Mock data seeding completed successfully!');
        // Disconnect from MongoDB
        await mongoose_1.default.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
    catch (error) {
        console.error('❌ Error seeding mock data:', error);
        await mongoose_1.default.disconnect().catch(() => { });
        throw error;
    }
}
async function seedUsers() {
    const client = await database_1.pgPool.connect();
    try {
        await client.query('BEGIN');
        for (const user of mockUsers) {
            // Generate mock password
            const passwordHash = await (0, auth_utils_1.hashPassword)('password123');
            // Generate mock email and phone
            const email = `${user.id}@raved.test`;
            const phone = `+233${Math.floor(200000000 + Math.random() * 799999999)}`;
            // Insert user
            const userResult = await client.query(`
        INSERT INTO users (
          username, email, phone, password_hash,
          first_name, last_name, avatar_url, bio, faculty,
          email_verified, phone_verified, subscription_tier,
          followers_count, following_count, posts_count,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (username) DO NOTHING
        RETURNING id
      `, [
                `mock_${user.id}`,
                email,
                phone,
                passwordHash,
                user.name.split(' ')[0],
                user.name.split(' ')[1] || 'User',
                user.avatar,
                `Student at ${user.faculty} faculty`,
                user.faculty,
                true,
                true,
                'free',
                Math.floor(Math.random() * 100) + 10,
                Math.floor(Math.random() * 100) + 10,
                Math.floor(Math.random() * 50) + 5,
                new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
                new Date()
            ]);
            const userId = userResult.rows[0]?.id;
            if (!userId)
                continue; // Skip if user wasn't inserted (already exists)
            // Initialize trust score
            await client.query(`
        INSERT INTO user_trust_scores (
          user_id, trust_score, account_age_days, is_verified
        ) VALUES ($1, $2, $3, $4)
      `, [userId, Math.floor(Math.random() * 30) + 70, Math.floor(Math.random() * 365), true]);
            // Initialize notification settings
            await client.query(`
        INSERT INTO notification_settings (user_id) VALUES ($1)
      `, [userId]);
        }
        await client.query('COMMIT');
        console.log(`✅ Seeded ${mockUsers.length} mock users`);
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function seedConnections() {
    const client = await database_1.pgPool.connect();
    try {
        await client.query('BEGIN');
        // Get all mock user IDs
        const userResult = await client.query('SELECT id FROM users WHERE username LIKE \'mock_%\'');
        const userIds = userResult.rows.map(row => row.id);
        // Create random connections
        for (const followerId of userIds) {
            // Each user follows 3-8 random other users
            const numFollows = Math.floor(Math.random() * 6) + 3;
            const shuffled = [...userIds].filter(id => id !== followerId).sort(() => 0.5 - Math.random());
            const followingIds = shuffled.slice(0, numFollows);
            for (const followingId of followingIds) {
                await client.query(`
          INSERT INTO connections (follower_id, following_id, status, created_at)
          VALUES ($1, $2, 'following', $3)
          ON CONFLICT (follower_id, following_id) DO NOTHING
        `, [followerId, followingId, new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)]);
            }
        }
        // Update follower/following counts
        for (const userId of userIds) {
            const followerCount = await client.query('SELECT COUNT(*) FROM connections WHERE following_id = $1', [userId]);
            const followingCount = await client.query('SELECT COUNT(*) FROM connections WHERE follower_id = $1', [userId]);
            await client.query(`
        UPDATE users SET
          followers_count = $2,
          following_count = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [userId, parseInt(followerCount.rows[0].count), parseInt(followingCount.rows[0].count)]);
        }
        await client.query('COMMIT');
        console.log('✅ Seeded connections and updated counts');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function seedPosts() {
    try {
        const userResult = await database_1.pgPool.query('SELECT id FROM users WHERE username LIKE \'mock_%\'');
        const userIds = userResult.rows.map(row => row.id);
        let postCount = 0;
        for (const userId of userIds) {
            // Each user creates 2-5 posts
            const numPosts = Math.floor(Math.random() * 4) + 2;
            for (let i = 0; i < numPosts; i++) {
                const postTypes = ['image', 'video', 'carousel'];
                const postType = postTypes[Math.floor(Math.random() * postTypes.length)];
                let media = {};
                if (postType === 'image') {
                    media = { image: mockImages[Math.floor(Math.random() * mockImages.length)] };
                }
                else if (postType === 'video') {
                    media = {
                        video: mockVideos[Math.floor(Math.random() * mockVideos.length)],
                        thumbnail: mockImages[Math.floor(Math.random() * mockImages.length)]
                    };
                }
                else if (postType === 'carousel') {
                    const numImages = Math.floor(Math.random() * 3) + 2;
                    media = { images: mockImages.slice(0, numImages) };
                }
                const caption = mockCaptions[Math.floor(Math.random() * mockCaptions.length)];
                const isForSale = Math.random() < 0.2; // 20% chance of being for sale
                let saleDetails = null;
                if (isForSale) {
                    saleDetails = {
                        price: Math.floor(Math.random() * 100) + 20,
                        condition: ['new', 'like-new', 'good'][Math.floor(Math.random() * 3)],
                        size: ['S', 'M', 'L', 'XL'][Math.floor(Math.random() * 4)],
                        category: 'clothing',
                        description: 'Great condition item',
                        paymentMethods: ['Mobile Money', 'Cash'],
                        contactPhone: '+233501234567',
                        meetupLocation: 'Campus Library'
                    };
                }
                const visibilities = ['public', 'faculty', 'connections'];
                const visibility = visibilities[Math.floor(Math.random() * visibilities.length)];
                const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
                // Get user faculty for post
                const userFacultyResult = await database_1.pgPool.query('SELECT faculty FROM users WHERE id = $1', [userId]);
                const faculty = userFacultyResult.rows[0]?.faculty || 'General';
                const postData = {
                    userId,
                    type: postType,
                    caption,
                    media,
                    location: 'Campus Library',
                    tags: ['OOTD', 'CampusStyle'],
                    visibility,
                    isForSale,
                    saleDetails,
                    likesCount: Math.floor(Math.random() * 50) + 5,
                    commentsCount: Math.floor(Math.random() * 20) + 2,
                    sharesCount: Math.floor(Math.random() * 10),
                    savesCount: Math.floor(Math.random() * 15),
                    viewsCount: Math.floor(Math.random() * 200) + 20,
                    faculty,
                    createdAt,
                    updatedAt: createdAt
                };
                await post_model_1.Post.create(postData);
                postCount++;
            }
        }
        console.log(`✅ Seeded ${postCount} mock posts in MongoDB`);
    }
    catch (error) {
        throw error;
    }
}
async function seedStories() {
    try {
        const userResult = await database_1.pgPool.query('SELECT id FROM users WHERE username LIKE \'mock_%\'');
        const userIds = userResult.rows.map(row => row.id);
        let storyCount = 0;
        for (const userId of userIds) {
            // 70% chance each user has stories
            if (Math.random() < 0.7) {
                const numStories = Math.floor(Math.random() * 3) + 1;
                for (let i = 0; i < numStories; i++) {
                    const storyTypes = ['image', 'video'];
                    const storyType = storyTypes[Math.floor(Math.random() * storyTypes.length)];
                    let media = {};
                    if (storyType === 'image') {
                        media = { image: mockImages[Math.floor(Math.random() * mockImages.length)] };
                    }
                    else {
                        media = {
                            video: mockVideos[Math.floor(Math.random() * mockVideos.length)],
                            thumbnail: mockImages[Math.floor(Math.random() * mockImages.length)]
                        };
                    }
                    const createdAt = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000); // Within last 24 hours
                    const storyData = {
                        userId,
                        type: storyType,
                        content: storyType === 'image' ? media.image : media.video, // URL for the content
                        thumbnail: media.thumbnail || media.image,
                        text: 'Daily update! 📸',
                        allowReplies: true,
                        addToHighlights: false,
                        viewsCount: Math.floor(Math.random() * 50) + 5,
                        repliesCount: 0,
                        expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000), // Expires in 24 hours
                        createdAt
                    };
                    await story_model_1.Story.create(storyData);
                    storyCount++;
                }
            }
        }
        console.log(`✅ Seeded ${storyCount} mock stories in MongoDB`);
    }
    catch (error) {
        throw error;
    }
}
async function seedStoreItems() {
    const client = await database_1.pgPool.connect();
    try {
        await client.query('BEGIN');
        for (const item of mockStoreItems) {
            // Get seller ID
            const sellerResult = await client.query('SELECT id FROM users WHERE username = $1', [`mock_${item.seller.id}`]);
            if (sellerResult.rows.length === 0)
                continue;
            const sellerId = sellerResult.rows[0].id;
            await client.query(`
        INSERT INTO store_items (
          seller_id, name, description, price, original_price,
          category, condition, size, brand,
          images, views_count, likes_count, saves_count, sales_count,
          payment_methods, meetup_location, seller_phone,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      `, [
                sellerId,
                item.name,
                item.description,
                item.price,
                item.originalPrice,
                item.category,
                item.condition,
                item.size,
                item.brand,
                item.images,
                item.stats.views,
                item.stats.likes,
                item.stats.saves,
                Math.floor(Math.random() * 5),
                item.paymentMethods,
                item.meetupLocation,
                item.seller.phone || '+233501234567',
                new Date(item.timestamp),
                new Date()
            ]);
        }
        await client.query('COMMIT');
        console.log(`✅ Seeded ${mockStoreItems.length} mock store items`);
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function seedEvents() {
    const client = await database_1.pgPool.connect();
    try {
        await client.query('BEGIN');
        const userResult = await client.query('SELECT id FROM users WHERE username LIKE \'mock_%\' ORDER BY RANDOM() LIMIT 3');
        const organizerIds = userResult.rows.map(row => row.id);
        const events = [
            {
                title: 'Campus Fashion Show 2024',
                description: 'Annual fashion showcase featuring student designers',
                category: 'fashion',
                audience: 'all',
                maxAttendees: 200,
                fee: 0,
                image: mockImages[0]
            },
            {
                title: 'Style Workshop: Thrift Edition',
                description: 'Learn how to style thrifted clothing',
                category: 'workshop',
                audience: 'all',
                maxAttendees: 50,
                fee: 5,
                image: mockImages[1]
            },
            {
                title: 'Business Casual Networking',
                description: 'Network with professionals in business attire',
                category: 'networking',
                audience: 'business',
                maxAttendees: 30,
                fee: 0,
                image: mockImages[2]
            }
        ];
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const organizerId = organizerIds[i % organizerIds.length];
            const eventDate = new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000); // Next few weeks
            const eventResult = await client.query(`
        INSERT INTO events (
          organizer_id, title, description, event_date, event_time,
          location, category, audience, max_attendees, registration_fee,
          image_url, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `, [
                organizerId,
                event.title,
                event.description,
                eventDate.toISOString().split('T')[0],
                '18:00:00',
                'Main Auditorium',
                event.category,
                event.audience,
                event.maxAttendees,
                event.fee,
                event.image,
                new Date(),
                new Date()
            ]);
            const eventId = eventResult.rows[0].id;
            // Add some attendees
            const numAttendees = Math.floor(Math.random() * 20) + 5;
            const attendeeIds = [...organizerIds].sort(() => 0.5 - Math.random()).slice(0, numAttendees);
            for (const attendeeId of attendeeIds) {
                if (attendeeId !== organizerId) {
                    await client.query(`
            INSERT INTO event_attendees (event_id, user_id, status)
            VALUES ($1, $2, 'attending')
            ON CONFLICT (event_id, user_id) DO NOTHING
          `, [eventId, attendeeId]);
                }
            }
            // Update attendee count
            await client.query(`
        UPDATE events SET current_attendees = $2 WHERE id = $1
      `, [eventId, attendeeIds.length]);
        }
        await client.query('COMMIT');
        console.log(`✅ Seeded ${events.length} mock events`);
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function seedConversations() {
    const client = await database_1.pgPool.connect();
    try {
        await client.query('BEGIN');
        const userResult = await client.query('SELECT id FROM users WHERE username LIKE \'mock_%\'');
        const userIds = userResult.rows.map(row => row.id);
        let conversationCount = 0;
        // Create conversations between random pairs
        for (let i = 0; i < userIds.length; i++) {
            for (let j = i + 1; j < userIds.length; j++) {
                if (Math.random() < 0.3) { // 30% chance of conversation between any pair
                    const user1Id = userIds[i];
                    const user2Id = userIds[j];
                    // Ensure user1Id < user2Id for the constraint
                    const [p1, p2] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
                    // Create conversation
                    const convResult = await client.query(`
            INSERT INTO conversations (
              participant1_id, participant2_id, created_at, updated_at
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (participant1_id, participant2_id) DO NOTHING
            RETURNING id
          `, [p1, p2, new Date(), new Date()]);
                    const conversationId = convResult.rows[0]?.id;
                    if (!conversationId)
                        continue; // Skip if conversation wasn't created (already exists)
                    // Add some messages
                    const numMessages = Math.floor(Math.random() * 10) + 3;
                    for (let k = 0; k < numMessages; k++) {
                        const senderId = Math.random() < 0.5 ? user1Id : user2Id;
                        const messages = [
                            'Hey! How are you?',
                            'Love your latest post!',
                            'Want to meet up for coffee?',
                            'That outfit looks amazing!',
                            'Thanks for the follow!',
                            'Are you going to the fashion show?',
                            'Have you seen the new store items?',
                            'Let\'s collaborate on a post!',
                            'Your style is so unique!',
                            'DM me if you need styling tips!'
                        ];
                        const message = messages[Math.floor(Math.random() * messages.length)];
                        const messageTime = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
                        await client.query(`
              INSERT INTO messages (
                conversation_id, sender_id, content, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5)
            `, [conversationId, senderId, message, messageTime, messageTime]);
                    }
                    // Update conversation with last message info
                    await client.query(`
            UPDATE conversations SET
              last_message_at = (SELECT MAX(created_at) FROM messages WHERE conversation_id = $1),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [conversationId]);
                    conversationCount++;
                }
            }
        }
        await client.query('COMMIT');
        console.log(`✅ Seeded ${conversationCount} mock conversations`);
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
async function seedUserScores() {
    const client = await database_1.pgPool.connect();
    try {
        await client.query('BEGIN');
        const userResult = await client.query('SELECT id FROM users WHERE username LIKE \'mock_%\'');
        const userIds = userResult.rows.map(row => row.id);
        for (const userId of userIds) {
            const weeklyScore = Math.floor(Math.random() * 500) + 100;
            const monthlyScore = Math.floor(Math.random() * 2000) + 500;
            const allTimeScore = Math.floor(Math.random() * 5000) + 1000;
            await client.query(`
        INSERT INTO user_scores (
          user_id, weekly_score, monthly_score, all_time_score,
          total_likes_received, total_comments_received, total_shares_received,
          total_sales, total_features
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id) DO NOTHING
      `, [
                userId,
                weeklyScore,
                monthlyScore,
                allTimeScore,
                Math.floor(Math.random() * 200) + 50,
                Math.floor(Math.random() * 100) + 20,
                Math.floor(Math.random() * 50) + 10,
                Math.floor(Math.random() * 20) + 5,
                Math.floor(Math.random() * 10) + 1
            ]);
        }
        await client.query('COMMIT');
        console.log(`✅ Seeded user scores for ${userIds.length} users`);
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
// Run seeding if this script is executed directly
if (require.main === module) {
    seedMockData()
        .then(() => {
        console.log('🏁 Mock data seeding script completed');
        process.exit(0);
    })
        .catch((error) => {
        console.error('💥 Mock data seeding script failed:', error);
        process.exit(1);
    });
}
