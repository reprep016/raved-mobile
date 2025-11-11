import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { usePostsStore } from '../../store/postsStore';
import { Post } from '../../types';
import { userApi, UserProfile } from '../../services/userApi';
import { subscriptionsApi } from '../../services/subscriptionsApi';

type ProfileTab = 'posts' | 'comments' | 'liked' | 'saved';

export default function ProfileScreen() {
  const router = useRouter();
  const { user: authUser, logout } = useAuth();
  const { savedPosts } = usePostsStore();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userComments, setUserComments] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [savedPostsList, setSavedPostsList] = useState<Post[]>([]);
  const [stats, setStats] = useState({ postCount: 0, followerCount: 0, followingCount: 0, likeCount: 0 });
  const [subscriptionStatus, setSubscriptionStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (authUser) {
      loadProfile();
    }
  }, [authUser]);

  useEffect(() => {
    if (profile) {
      loadTabContent();
    }
  }, [activeTab, profile]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const [profileData, statsData, subscriptionData] = await Promise.all([
        userApi.getProfile(),
        userApi.getUserStats(),
        subscriptionsApi.getSubscriptionStatus(),
      ]);
      setProfile(profileData.user);
      setStats(statsData.stats);
      setSubscriptionStatus(subscriptionData);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTabContent = async () => {
    if (!profile) return;
    
    try {
      setLoadingTab(true);
      switch (activeTab) {
        case 'posts':
          const postsData = await userApi.getUserPosts(profile.id);
          setUserPosts(postsData.posts || []);
          break;
        case 'comments':
          const commentsData = await userApi.getUserComments(profile.id);
          setUserComments(commentsData.comments || []);
          break;
        case 'liked':
          const likedData = await userApi.getUserLikedPosts(profile.id);
          setLikedPosts(likedData.posts || []);
          break;
        case 'saved':
          const savedData = await userApi.getUserSavedPosts(profile.id);
          setSavedPostsList(savedData.posts || []);
          break;
      }
    } catch (error) {
      console.error('Failed to load tab content:', error);
    } finally {
      setLoadingTab(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    await loadTabContent();
    setRefreshing(false);
  };

  if (!authUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Please log in to view your profile</Text>
          <Button
            title="Go to Login"
            onPress={() => router.push('/(auth)/login' as any)}
            variant="primary"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const getTabContent = (): Post[] => {
    switch (activeTab) {
      case 'posts':
        return userPosts;
      case 'liked':
        return likedPosts;
      case 'saved':
        return savedPostsList;
      case 'comments':
        return []; // Comments are handled separately
      default:
        return [];
    }
  };

  const renderPostGrid = (posts: Post[]) => {
    if (posts.length === 0) {
      const emptyConfig: Record<ProfileTab, { icon: keyof typeof Ionicons.glyphMap; text: string; action?: string }> = {
        posts: { icon: 'camera-outline', text: 'No posts yet', action: 'Create Your First Post' },
        comments: { icon: 'chatbubble-outline', text: 'No comments yet' },
        liked: { icon: 'heart-outline', text: 'No liked posts yet' },
        saved: { icon: 'bookmark-outline', text: 'No saved posts yet' },
      };
      const config = emptyConfig[activeTab];

      return (
        <EmptyState
          icon={config.icon}
          title={config.text}
          actionLabel={config.action}
          onAction={config.action && activeTab === 'posts' ? () => router.push('/(tabs)/create' as any) : undefined}
        />
      );
    }

    return (
      <FlatList
        data={posts}
        numColumns={3}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.postThumbnail}
            onPress={() => router.push(`/post/${item.id}` as any)}
          >
            <Image
              source={{ uri: item.media.url || item.media.items?.[0] || item.media.thumbnail || '' }}
              style={styles.thumbnailImage}
            />
            {item.media.type === 'video' && (
              <View style={styles.videoOverlay}>
                <Ionicons name="play" size={16} color="white" />
              </View>
            )}
            {item.media.type === 'carousel' && (
              <View style={styles.carouselOverlay}>
                <Ionicons name="copy" size={12} color="white" />
              </View>
            )}
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ width: 2 }} />}
        columnWrapperStyle={styles.postRow}
      />
    );
  };

  const renderComments = () => {
    if (loadingTab) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      );
    }

    if (userComments.length === 0) {
      return (
        <EmptyState
          icon="chatbubble-outline"
          title="No comments yet"
        />
      );
    }

    return (
      <FlatList
        data={userComments}
        renderItem={({ item }) => (
          <View style={styles.commentCard}>
            <Text style={styles.commentText}>{item.text}</Text>
            {item.post && (
              <Text style={styles.commentPostPreview} numberOfLines={1}>
                On: {item.post.caption || 'Post'}
              </Text>
            )}
            <Text style={styles.commentTime}>{item.timeAgo}</Text>
          </View>
        )}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing[2] }} />}
      />
    );
  };

  if (!profile) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.userInfo}>
              <View style={styles.avatarContainer}>
                <Avatar uri={profile.avatarUrl || ''} size={80} />
                <TouchableOpacity 
                  style={styles.changeAvatarButton}
                  onPress={() => router.push('/avatar-picker' as any)}
                >
                  <Ionicons name="camera" size={12} color="white" />
                </TouchableOpacity>
                {profile.isPremium && (
                  <View style={styles.premiumBadge}>
                    <Ionicons name="diamond" size={12} color="#FCD34D" />
                  </View>
                )}
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>
                  {profile.firstName} {profile.lastName}
                </Text>
                <Text style={styles.username}>@{profile.username}</Text>
                <Text style={styles.bio}>{profile.bio || 'No bio yet'}</Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={12} color="#9CA3AF" />
                  <Text style={styles.location}>
                    {profile.location || 'No location'} • Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => router.push('/profile-settings' as any)}
            >
              <Ionicons name="settings" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.postCount}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.followerCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.followingCount}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.likeCount}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Button
              title="Edit Profile"
              onPress={() => router.push('/edit-profile' as any)}
              variant="primary"
              size="medium"
              leftIcon={<Ionicons name="create" size={16} color="white" />}
              style={styles.editButton}
            />
            <TouchableOpacity style={styles.shareButton}>
              <Ionicons name="share" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Subscription Status Card */}
          {subscriptionStatus && !subscriptionStatus.isPremium && (
            <View style={styles.subscriptionCard}>
              <View style={styles.subscriptionContent}>
                <View>
                  <Text style={styles.subscriptionTitle}>
                    {subscriptionStatus.isTrial ? 'Free Trial' : 'Free Account'}
                  </Text>
                  {subscriptionStatus.trialDaysLeft !== null && (
                    <Text style={styles.subscriptionSubtitle}>
                      {subscriptionStatus.trialDaysLeft} days remaining
                    </Text>
                  )}
                </View>
                <Button
                  title="Upgrade"
                  onPress={() => router.push('/subscription' as any)}
                  variant="primary"
                  size="small"
                  leftIcon={<Ionicons name="diamond" size={12} color="white" />}
                  style={styles.upgradeButton}
                />
              </View>
            </View>
          )}
        </View>

        {/* Profile Tabs */}
        <View style={styles.tabsContainer}>
          <View style={styles.tabsHeader}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
              onPress={() => setActiveTab('posts')}
            >
              <Ionicons
                name="grid"
                size={16}
                color={activeTab === 'posts' ? theme.colors.primary : '#6B7280'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'posts' && styles.tabTextActive,
                ]}
              >
                Posts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'comments' && styles.tabActive]}
              onPress={() => setActiveTab('comments')}
            >
              <Ionicons
                name="chatbubbles"
                size={16}
                color={activeTab === 'comments' ? theme.colors.primary : '#6B7280'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'comments' && styles.tabTextActive,
                ]}
              >
                Comments
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'liked' && styles.tabActive]}
              onPress={() => setActiveTab('liked')}
            >
              <Ionicons
                name="heart"
                size={16}
                color={activeTab === 'liked' ? theme.colors.primary : '#6B7280'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'liked' && styles.tabTextActive,
                ]}
              >
                Liked
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
              onPress={() => setActiveTab('saved')}
            >
              <Ionicons
                name="bookmark"
                size={16}
                color={activeTab === 'saved' ? theme.colors.primary : '#6B7280'}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'saved' && styles.tabTextActive,
                ]}
              >
                Saved
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {loadingTab && getTabContent().length === 0 && activeTab !== 'comments' ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : activeTab === 'comments' ? (
              renderComments()
            ) : (
              renderPostGrid(getTabContent())
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: theme.spacing[4],
    backgroundColor: '#FFFFFF',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[4],
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing[3],
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  changeAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: theme.typography.fontSize[20],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#111827',
    marginBottom: 2,
  },
  username: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary,
    marginBottom: 4,
  },
  bio: {
    fontSize: theme.typography.fontSize[14],
    color: '#6B7280',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: theme.typography.fontSize[12],
    color: '#9CA3AF',
  },
  settingsButton: {
    padding: theme.spacing[2],
    borderRadius: theme.borderRadius.full,
    backgroundColor: '#F3F4F6',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing[4],
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.typography.fontSize[18],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: theme.typography.fontSize[10],
    color: '#6B7280',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing[2],
    marginBottom: theme.spacing[4],
  },
  editButton: {
    flex: 1,
  },
  shareButton: {
    padding: theme.spacing[2],
    borderRadius: theme.borderRadius.xl,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    width: 48,
  },
  subscriptionCard: {
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#FCD34D',
    backgroundColor: '#FEF9C3',
  },
  subscriptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subscriptionTitle: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#92400E',
    marginBottom: 2,
  },
  subscriptionSubtitle: {
    fontSize: theme.typography.fontSize[12],
    color: '#A16207',
  },
  upgradeButton: {
    minWidth: 100,
  },
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    marginTop: theme.spacing[2],
  },
  tabsHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing[1],
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.medium,
    color: '#6B7280',
  },
  tabTextActive: {
    color: theme.colors.primary,
  },
  tabContent: {
    padding: theme.spacing[4],
    minHeight: 300,
  },
  postRow: {
    gap: 2,
  },
  postThumbnail: {
    flex: 1,
    aspectRatio: 1,
    margin: 0.5,
    borderRadius: theme.borderRadius.base,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    borderRadius: 4,
  },
  carouselOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    borderRadius: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing[12],
    gap: theme.spacing[3],
  },
  emptyText: {
    fontSize: theme.typography.fontSize[14],
    color: '#6B7280',
  },
  emptyActionButton: {
    marginTop: theme.spacing[2],
  },
  loadingContainer: {
    paddingVertical: theme.spacing[12],
    alignItems: 'center',
  },
  premiumBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEF9C3',
    borderWidth: 2,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentCard: {
    padding: theme.spacing[3],
    backgroundColor: '#F9FAFB',
    borderRadius: theme.borderRadius.xl,
  },
  commentText: {
    fontSize: theme.typography.fontSize[14],
    color: '#111827',
    marginBottom: theme.spacing[1],
  },
  commentPostPreview: {
    fontSize: theme.typography.fontSize[12],
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: theme.spacing[1],
  },
  commentTime: {
    fontSize: theme.typography.fontSize[10],
    color: '#9CA3AF',
  },
});
