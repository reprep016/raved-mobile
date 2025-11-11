import { pgPool } from '../config/database';
import { hashPassword } from '../utils/auth.utils';
import mongoose from 'mongoose';
import { Post } from '../models/mongoose/post.model';
import { Story } from '../models/mongoose/story.model';
import { Comment } from '../models/mongoose/comment.model';
import { Like } from '../models/mongoose/like.model';

// Mock data definitions - matching frontend mockData.ts
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

// Mock events matching frontend
const mockEvents = [
  {
    id: 'ev1',
    title: 'Spring Fashion Show 2024',
    organizer: 'Fashion Society',
    orgAvatar: mockUsers[0].avatar,
    date: '2025-08-15',
    time: '19:00',
    location: 'Main Auditorium',
    category: 'cultural',
    audience: 'all',
    description: 'The biggest fashion show of the year featuring student designers.',
    image: mockImages[0],
    attendees: 156,
    max: 200,
    tags: ['Fashion', 'Student Work', 'Networking'],
  },
  {
    id: 'ev2',
    title: 'Sustainable Fashion Workshop',
    organizer: 'Environmental Club',
    orgAvatar: mockUsers[1].avatar,
    date: '2025-08-10',
    time: '14:00',
    location: 'Science Building Room 201',
    category: 'academic',
    audience: 'undergraduate',
    description: 'Learn eco-friendly outfit practices and tips.',
    image: mockImages[2],
    attendees: 45,
    max: 50,
    tags: ['Sustainability', 'Workshop'],
  },
  {
    id: 'ev3',
    title: 'Graduate Fashion Research Symposium',
    organizer: 'Graduate School',
    orgAvatar: mockUsers[2].avatar,
    date: '2025-08-20',
    time: '10:00',
    location: 'Research Center',
    category: 'networking',
    audience: 'graduate',
    description: 'Present and discuss latest fashion research findings.',
    image: mockImages[1],
    attendees: 28,
    max: 40,
    tags: ['Research', 'Graduate', 'Academic'],
  },
  {
    id: 'ev4',
    title: 'Faculty Fashion Lecture Series',
    organizer: 'Design Department',
    orgAvatar: mockUsers[3].avatar,
    date: '2025-08-25',
    time: '16:00',
    location: 'Design Studio',
    category: 'academic',
    audience: 'faculty',
    description: 'Professional development for fashion educators.',
    image: mockImages[3],
    attendees: 15,
    max: 25,
    tags: ['Professional', 'Education', 'Faculty'],
  },
  {
    id: 'ev5',
    title: 'Alumni Fashion Network Mixer',
    organizer: 'Alumni Association',
    orgAvatar: mockUsers[4].avatar,
    date: '2025-08-30',
    time: '18:00',
    location: 'Alumni Center',
    category: 'networking',
    audience: 'all',
    description: 'Connect with fashion industry professionals.',
    image: mockImages[4],
    attendees: 67,
    max: 80,
    tags: ['Alumni', 'Networking', 'Industry'],
  },
  {
    id: 'ev6',
    title: 'Public Fashion Exhibition',
    organizer: 'Art Gallery',
    orgAvatar: mockUsers[5].avatar,
    date: '2025-09-05',
    time: '12:00',
    location: 'City Art Gallery',
    category: 'cultural',
    audience: 'all',
    description: 'Open to the public - showcasing student fashion art.',
    image: mockImages[5],
    attendees: 234,
    max: 300,
    tags: ['Public', 'Exhibition', 'Art'],
  },
];

// Mock data seeding script
async function seedMockData() {
  try {
    console.log('🌱 Starting comprehensive mock data seeding...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/raved', {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
    console.log('✅ Connected to MongoDB for seeding');

    // Ensure role column exists
    await pgPool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
    `);

    // Seed admin user first
    console.log('👑 Seeding admin user...');
    await seedAdminUser();

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

    // Seed store items (generate more items)
    console.log('🛍️ Seeding store items...');
    await seedStoreItems();
    
    // Generate additional store items
    console.log('🛍️ Generating additional store items...');
    await generateAdditionalStoreItems();

    // Seed events
    console.log('📅 Seeding events...');
    await seedEvents();

    // Seed conversations and messages (generate more)
    console.log('💬 Seeding conversations...');
    await seedConversations();
    
    // Generate additional conversations
    console.log('💬 Generating additional conversations...');
    await generateAdditionalConversations();

    // Seed user scores for rankings
    console.log('🏆 Seeding user scores...');
    await seedUserScores();

    // Seed likes and comments
    console.log('❤️ Seeding likes and comments...');
    await seedLikesAndComments();

    console.log('✅ Mock data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Admin user: admin / admin123');
    console.log('   - Mock users: password123 (username: mock_u1, mock_u2, etc.)');
    console.log('   - All mock data from frontend has been seeded');

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error seeding mock data:', error);
    await mongoose.disconnect().catch(() => {});
    throw error;
  }
}

async function seedAdminUser() {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    const adminPassword = await hashPassword('admin123');
    const adminResult = await client.query(`
      INSERT INTO users (
        username, email, phone, password_hash,
        first_name, last_name, faculty, university,
        email_verified, phone_verified, role, subscription_tier,
        followers_count, following_count, posts_count,
        created_at, updated_at
      ) VALUES (
        'admin', 'admin@raved.app', '+233123456789', $1,
        'System', 'Administrator', 'Administration', 'Raved University',
        true, true, 'admin', 'premium',
        0, 0, 0,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (username) DO UPDATE SET
        role = 'admin',
        subscription_tier = 'premium',
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [adminPassword]);

    const adminId = adminResult.rows[0]?.id;
    if (adminId) {
      // Initialize trust score for admin
      await client.query(`
        INSERT INTO user_trust_scores (
          user_id, trust_score, account_age_days, is_verified, created_at, updated_at
        ) VALUES ($1, 100, 365, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
          trust_score = 100,
          is_verified = true,
          updated_at = CURRENT_TIMESTAMP
      `, [adminId]);

      // Initialize notification settings
      await client.query(`
        INSERT INTO notification_settings (user_id) VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `, [adminId]);
    }

    await client.query('COMMIT');
    console.log('✅ Admin user seeded (username: admin, password: admin123)');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function seedUsers() {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    for (const user of mockUsers) {
      // Generate mock password
      const passwordHash = await hashPassword('password123');

      // Generate mock email and phone
      const email = `${user.id}@raved.test`;
      const phone = `+233${Math.floor(200000000 + Math.random() * 799999999)}`;

      // Insert user
      const userResult = await client.query(`
        INSERT INTO users (
          username, email, phone, password_hash,
          first_name, last_name, avatar_url, bio, faculty,
          email_verified, phone_verified, subscription_tier, role,
          followers_count, following_count, posts_count,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (username) DO UPDATE SET
          avatar_url = EXCLUDED.avatar_url,
          bio = EXCLUDED.bio,
          faculty = EXCLUDED.faculty,
          updated_at = CURRENT_TIMESTAMP
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
        'user',
        Math.floor(Math.random() * 100) + 10,
        Math.floor(Math.random() * 100) + 10,
        Math.floor(Math.random() * 50) + 5,
        new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        new Date()
      ]);

      const userId = userResult.rows[0]?.id;
      if (!userId) {
        // User already exists, get the ID
        const existingUser = await client.query('SELECT id FROM users WHERE username = $1', [`mock_${user.id}`]);
        if (existingUser.rows.length > 0) {
          continue;
        }
      }

      // Initialize trust score
      await client.query(`
        INSERT INTO user_trust_scores (
          user_id, trust_score, account_age_days, is_verified
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO NOTHING
      `, [userId, Math.floor(Math.random() * 30) + 70, Math.floor(Math.random() * 365), true]);

      // Initialize notification settings
      await client.query(`
        INSERT INTO notification_settings (user_id) VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
      `, [userId]);
    }

    await client.query('COMMIT');
    console.log(`✅ Seeded ${mockUsers.length} mock users`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function seedConnections() {
  const client = await pgPool.connect();
  try {
    // Get all mock user IDs
    const userResult = await client.query('SELECT id FROM users WHERE username LIKE \'mock_%\'');
    const userIds = userResult.rows.map(row => row.id);

    if (userIds.length === 0) {
      console.log('⚠️ No mock users found, skipping connections');
      return;
    }

    await client.query('BEGIN');

    // Create random connections
    const connections: Array<{followerId: string, followingId: string, createdAt: Date}> = [];
    for (const followerId of userIds) {
      // Each user follows 3-8 random other users
      const numFollows = Math.floor(Math.random() * 6) + 3;
      const shuffled = [...userIds].filter(id => id !== followerId).sort(() => 0.5 - Math.random());
      const followingIds = shuffled.slice(0, Math.min(numFollows, shuffled.length));

      for (const followingId of followingIds) {
        connections.push({
          followerId,
          followingId,
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        });
      }
    }

    // Insert all connections
    for (const conn of connections) {
      await client.query(`
        INSERT INTO connections (follower_id, following_id, status, created_at)
        VALUES ($1, $2, 'accepted', $3)
        ON CONFLICT (follower_id, following_id) DO NOTHING
      `, [conn.followerId, conn.followingId, conn.createdAt]);
    }

    await client.query('COMMIT');
    client.release();

    // Update counts in separate transactions to avoid deadlocks
    for (const userId of userIds) {
      const updateClient = await pgPool.connect();
      try {
        const followerCount = await updateClient.query('SELECT COUNT(*) FROM connections WHERE following_id = $1 AND status = \'accepted\'', [userId]);
        const followingCount = await updateClient.query('SELECT COUNT(*) FROM connections WHERE follower_id = $1 AND status = \'accepted\'', [userId]);

        await updateClient.query(`
          UPDATE users SET
            followers_count = $2,
            following_count = $3,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [userId, parseInt(followerCount.rows[0].count), parseInt(followingCount.rows[0].count)]);
      } finally {
        updateClient.release();
      }
    }

    console.log('✅ Seeded connections and updated counts');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    throw error;
  }
}

async function seedPosts() {
  try {
    const userResult = await pgPool.query('SELECT id FROM users WHERE username LIKE \'mock_%\'');
    const userIds = userResult.rows.map(row => row.id);

    if (userIds.length === 0) {
      console.log('⚠️ No mock users found, skipping posts');
      return;
    }

    // Clear existing posts from mock users
    await Post.deleteMany({ userId: { $in: userIds } });

    let postCount = 0;

    for (const userId of userIds) {
      // Each user creates 8-15 posts (increased for more data)
      const numPosts = Math.floor(Math.random() * 8) + 8;

      for (let i = 0; i < numPosts; i++) {
        const postTypes = ['image', 'video', 'carousel'];
        const postType = postTypes[Math.floor(Math.random() * postTypes.length)];

        let media: any = {};
        if (postType === 'image') {
          media = { image: mockImages[Math.floor(Math.random() * mockImages.length)] };
        } else if (postType === 'video') {
          media = {
            video: mockVideos[Math.floor(Math.random() * mockVideos.length)],
            thumbnail: mockImages[Math.floor(Math.random() * mockImages.length)]
          };
        } else if (postType === 'carousel') {
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
        const userFacultyResult = await pgPool.query('SELECT faculty FROM users WHERE id = $1', [userId]);
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

        await Post.create(postData);
        postCount++;
      }
    }

    // Update post counts for users
    for (const userId of userIds) {
      const postCountResult = await Post.countDocuments({ userId });
      await pgPool.query('UPDATE users SET posts_count = $1 WHERE id = $2', [postCountResult, userId]);
    }

    console.log(`✅ Seeded ${postCount} mock posts in MongoDB`);
  } catch (error) {
    throw error;
  }
}

async function seedStories() {
  try {
    const userResult = await pgPool.query('SELECT id FROM users WHERE username LIKE \'mock_%\'');
    const userIds = userResult.rows.map(row => row.id);

    if (userIds.length === 0) {
      console.log('⚠️ No mock users found, skipping stories');
      return;
    }

    // Clear existing stories
    await Story.deleteMany({ userId: { $in: userIds } });

    let storyCount = 0;

    for (const userId of userIds) {
      // 90% chance each user has stories, more stories per user
      if (Math.random() < 0.9) {
        const numStories = Math.floor(Math.random() * 5) + 2;

        for (let i = 0; i < numStories; i++) {
          const storyTypes = ['image', 'video'];
          const storyType = storyTypes[Math.floor(Math.random() * storyTypes.length)];

          let media: any = {};
          if (storyType === 'image') {
            media = { image: mockImages[Math.floor(Math.random() * mockImages.length)] };
          } else {
            media = {
              video: mockVideos[Math.floor(Math.random() * mockVideos.length)],
              thumbnail: mockImages[Math.floor(Math.random() * mockImages.length)]
            };
          }

          const createdAt = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000); // Within last 24 hours

          const storyData = {
            userId,
            type: storyType,
            content: storyType === 'image' ? media.image : media.video,
            thumbnail: media.thumbnail || media.image,
            text: 'Daily update! 📸',
            allowReplies: true,
            addToHighlights: false,
            viewsCount: Math.floor(Math.random() * 50) + 5,
            repliesCount: 0,
            expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000), // Expires in 24 hours
            createdAt
          };

          await Story.create(storyData);
          storyCount++;
        }
      }
    }

    console.log(`✅ Seeded ${storyCount} mock stories in MongoDB`);
  } catch (error) {
    throw error;
  }
}

async function seedStoreItems() {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing store items
    await client.query('DELETE FROM store_items WHERE seller_id IN (SELECT id FROM users WHERE username LIKE \'mock_%\')');

    for (const item of mockStoreItems) {
      // Get seller ID
      const sellerResult = await client.query('SELECT id FROM users WHERE username = $1', [`mock_${item.seller.id}`]);
      if (sellerResult.rows.length === 0) continue;

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
        item.images, // PostgreSQL array
        item.stats.views,
        item.stats.likes,
        item.stats.saves,
        Math.floor(Math.random() * 5),
        item.paymentMethods, // PostgreSQL array
        item.meetupLocation,
        item.seller.phone || '+233501234567',
        new Date(item.timestamp),
        new Date()
      ]);
    }

    await client.query('COMMIT');
    console.log(`✅ Seeded ${mockStoreItems.length} mock store items`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function seedEvents() {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing events
    await client.query('DELETE FROM events WHERE organizer_id IN (SELECT id FROM users WHERE username LIKE \'mock_%\')');

    const userResult = await client.query('SELECT id FROM users WHERE username LIKE \'mock_%\'');
    const userIds = userResult.rows.map(row => row.id);

    if (userIds.length === 0) {
      console.log('⚠️ No mock users found, skipping events');
      await client.query('COMMIT');
      return;
    }

    for (let i = 0; i < mockEvents.length; i++) {
      const event = mockEvents[i];
      const organizerId = userIds[i % userIds.length];
      
      // Parse date
      const eventDate = new Date(event.date);
      const [hours, minutes] = event.time.split(':');

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
        `${hours}:${minutes}:00`,
        event.location,
        event.category,
        event.audience,
        event.max,
        0, // Free events
        event.image,
        new Date(),
        new Date()
      ]);

      const eventId = eventResult.rows[0].id;

      // Add some attendees
      const numAttendees = Math.min(event.attendees, event.max);
      const attendeeIds = [...userIds].sort(() => 0.5 - Math.random()).slice(0, numAttendees);

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
    console.log(`✅ Seeded ${mockEvents.length} mock events`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function seedConversations() {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query('SELECT id FROM users WHERE username LIKE \'mock_%\'');
    const userIds = userResult.rows.map(row => row.id);

    if (userIds.length === 0) {
      console.log('⚠️ No mock users found, skipping conversations');
      await client.query('COMMIT');
      return;
    }

    let conversationCount = 0;

    // Create conversations between random pairs
    for (let i = 0; i < userIds.length; i++) {
      for (let j = i + 1; j < userIds.length; j++) {
        if (Math.random() < 0.6) { // 60% chance of conversation between any pair (increased)
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
          if (!conversationId) continue; // Skip if conversation wasn't created (already exists)

          // Add more messages
          const numMessages = Math.floor(Math.random() * 15) + 5;
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
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function seedUserScores() {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query('SELECT id FROM users WHERE username LIKE \'mock_%\'');
    const userIds = userResult.rows.map(row => row.id);

    if (userIds.length === 0) {
      console.log('⚠️ No mock users found, skipping user scores');
      await client.query('COMMIT');
      return;
    }

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
        ON CONFLICT (user_id) DO UPDATE SET
          weekly_score = EXCLUDED.weekly_score,
          monthly_score = EXCLUDED.monthly_score,
          all_time_score = EXCLUDED.all_time_score
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
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function generateAdditionalStoreItems() {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query('SELECT id FROM users WHERE username LIKE \'mock_%\'');
    const userIds = userResult.rows.map(row => row.id);

    if (userIds.length === 0) {
      await client.query('COMMIT');
      return;
    }

    const additionalItems = [
      { name: 'Designer Handbag', price: 120, category: 'bags', condition: 'like-new', size: 'One Size', brand: 'Coach' },
      { name: 'Running Shoes', price: 65, category: 'shoes', condition: 'good', size: '42', brand: 'Nike' },
      { name: 'Vintage Sunglasses', price: 35, category: 'accessories', condition: 'good', size: 'One Size', brand: 'Ray-Ban' },
      { name: 'Leather Jacket', price: 150, category: 'clothing', condition: 'like-new', size: 'L', brand: 'Zara' },
      { name: 'Silk Scarf', price: 25, category: 'accessories', condition: 'new', size: 'One Size', brand: 'Hermes' },
      { name: 'High Heels', price: 55, category: 'shoes', condition: 'good', size: '38', brand: 'Steve Madden' },
      { name: 'Denim Jeans', price: 45, category: 'clothing', condition: 'like-new', size: 'M', brand: 'Levi\'s' },
      { name: 'Wool Sweater', price: 40, category: 'clothing', condition: 'good', size: 'L', brand: 'H&M' },
      { name: 'Canvas Backpack', price: 30, category: 'bags', condition: 'new', size: 'One Size', brand: 'Fjallraven' },
      { name: 'Gold Necklace', price: 85, category: 'jewelry', condition: 'like-new', size: 'One Size', brand: 'Pandora' },
      { name: 'Summer Dress', price: 50, category: 'clothing', condition: 'new', size: 'S', brand: 'Forever 21' },
      { name: 'Ankle Boots', price: 70, category: 'shoes', condition: 'like-new', size: '39', brand: 'Dr. Martens' },
      { name: 'Baseball Cap', price: 20, category: 'accessories', condition: 'new', size: 'One Size', brand: 'Nike' },
      { name: 'Trench Coat', price: 110, category: 'clothing', condition: 'like-new', size: 'M', brand: 'Burberry' },
      { name: 'Crossbody Bag', price: 60, category: 'bags', condition: 'new', size: 'One Size', brand: 'Michael Kors' },
    ];

    for (const item of additionalItems) {
      const sellerId = userIds[Math.floor(Math.random() * userIds.length)];
      const imageIndex = Math.floor(Math.random() * mockImages.length);
      
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
        `Great quality ${item.name.toLowerCase()} in ${item.condition} condition`,
        item.price,
        item.price * 1.3, // Original price 30% higher
        item.category,
        item.condition,
        item.size,
        item.brand,
        [mockImages[imageIndex]],
        Math.floor(Math.random() * 200) + 50,
        Math.floor(Math.random() * 50) + 10,
        Math.floor(Math.random() * 20) + 5,
        Math.floor(Math.random() * 3),
        ['Mobile Money', 'Cash'],
        'Campus Library',
        '+233501234567',
        new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
        new Date()
      ]);
    }

    await client.query('COMMIT');
    console.log(`✅ Generated ${additionalItems.length} additional store items`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function generateAdditionalConversations() {
  const client = await pgPool.connect();
  try {
    const userResult = await client.query('SELECT id FROM users WHERE username LIKE \'mock_%\'');
    const userIds = userResult.rows.map(row => row.id);

    if (userIds.length === 0) {
      return;
    }

    await client.query('BEGIN');

    // Create more conversations between different pairs
    const existingPairs = new Set<string>();
    const allPairs: Array<{user1Id: string, user2Id: string}> = [];
    
    for (let i = 0; i < userIds.length; i++) {
      for (let j = i + 1; j < userIds.length; j++) {
        const pairKey = userIds[i] < userIds[j] ? `${userIds[i]}-${userIds[j]}` : `${userIds[j]}-${userIds[i]}`;
        if (!existingPairs.has(pairKey)) {
          allPairs.push({
            user1Id: userIds[i] < userIds[j] ? userIds[i] : userIds[j],
            user2Id: userIds[i] < userIds[j] ? userIds[j] : userIds[i]
          });
          existingPairs.add(pairKey);
        }
      }
    }

    // Create conversations for 80% of pairs
    const pairsToCreate = allPairs.filter(() => Math.random() < 0.8);
    let conversationCount = 0;

    for (const pair of pairsToCreate) {
      const convResult = await client.query(`
        INSERT INTO conversations (
          participant1_id, participant2_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (participant1_id, participant2_id) DO NOTHING
        RETURNING id
      `, [pair.user1Id, pair.user2Id, new Date(), new Date()]);

      const conversationId = convResult.rows[0]?.id;
      if (!conversationId) continue;

      // Add messages
      const numMessages = Math.floor(Math.random() * 20) + 10;
      for (let k = 0; k < numMessages; k++) {
        const senderId = Math.random() < 0.5 ? pair.user1Id : pair.user2Id;
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
          'DM me if you need styling tips!',
          'Can you help me with an outfit?',
          'What do you think of this look?',
          'Great find on that item!',
          'Would love to see more of your posts',
          'Your fashion sense is inspiring!',
          'Let\'s connect more often!',
          'That color looks great on you!',
          'Where did you get that?',
          'I need fashion advice!',
          'Your posts are always on point!'
        ];

        const message = messages[Math.floor(Math.random() * messages.length)];
        const messageTime = new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000);

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

    await client.query('COMMIT');
    console.log(`✅ Generated ${conversationCount} additional conversations`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function seedLikesAndComments() {
  try {
    const userResult = await pgPool.query('SELECT id FROM users WHERE username LIKE \'mock_%\'');
    const userIds = userResult.rows.map(row => row.id);

    if (userIds.length === 0) {
      console.log('⚠️ No mock users found, skipping likes and comments');
      return;
    }

    // Get all posts
    const posts = await Post.find({ deletedAt: null }).lean();
    
    if (posts.length === 0) {
      console.log('⚠️ No posts found, skipping likes and comments');
      return;
    }

    let likeCount = 0;
    let commentCount = 0;

    // Add likes to posts
    for (const post of posts) {
      // Each post gets 5-30 random likes
      const numLikes = Math.floor(Math.random() * 25) + 5;
      const shuffledUsers = [...userIds].sort(() => 0.5 - Math.random()).slice(0, numLikes);

      for (const userId of shuffledUsers) {
        await Like.findOneAndUpdate(
          { userId, targetId: post._id.toString(), targetType: 'post' },
          {
            userId,
            targetId: post._id.toString(),
            targetType: 'post',
            createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
          },
          { upsert: true, new: true }
        );
        likeCount++;
      }

      // Add comments to posts
      const numComments = Math.floor(Math.random() * 10) + 2;
      const commentUsers = [...userIds].sort(() => 0.5 - Math.random()).slice(0, numComments);

      for (const userId of commentUsers) {
        const comments = [
          'Love this! ❤️',
          'Amazing style!',
          'Where did you get this?',
          'So cute!',
          'Perfect outfit!',
          'Need this in my wardrobe!',
          'Great choice!',
          'Looking good!',
          'This is fire! 🔥',
          'Absolutely stunning!'
        ];

        await Comment.create({
          userId,
          postId: post._id.toString(),
          text: comments[Math.floor(Math.random() * comments.length)],
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        });
        commentCount++;
      }

      // Update post counts
      const likesCount = await Like.countDocuments({ targetId: post._id.toString(), targetType: 'post' });
      const commentsCount = await Comment.countDocuments({ postId: post._id.toString(), deletedAt: null });
      
      await Post.updateOne(
        { _id: post._id },
        { 
          $set: { 
            likesCount,
            commentsCount
          }
        }
      );
    }

    console.log(`✅ Seeded ${likeCount} likes and ${commentCount} comments`);
  } catch (error) {
    throw error;
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

export { seedMockData };
