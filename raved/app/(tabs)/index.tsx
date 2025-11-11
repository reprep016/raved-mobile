import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { usePosts } from '../../hooks/usePosts';
import { useStore } from '../../hooks/useStore';
import { theme } from '../../theme';
import { StoryRow } from '../../components/stories/StoryRow';
import { PostCard } from '../../components/posts/PostCard';
import { Avatar } from '../../components/ui/Avatar';
import { MoreSheet } from '../../components/sheets/MoreSheet';
import { FloatingActionButtons } from '../../components/ui/FloatingActionButtons';
import { userApi } from '../../services/userApi';

export default function HomeScreen() {
  const router = useRouter();
  const { isDark, currentColors, toggleDarkMode } = useTheme();
  const { user } = useAuth();
  const { posts, featuredPost, stories, refreshFeed } = usePosts();
  const { isPremium, storeItems } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [displayedPosts, setDisplayedPosts] = useState(posts.slice(0, 5));
  const [moreSheetVisible, setMoreSheetVisible] = useState(false);
  const [rankings, setRankings] = useState([]);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showTrending, setShowTrending] = useState(false);

  useEffect(() => {
    setDisplayedPosts(posts.slice(0, 5));
  }, [posts.length]);

  useEffect(() => {
    if (isPremium) {
      fetchRankings();
    }
    fetchSuggestions();
    fetchTrending();
  }, [isPremium]);

  const fetchSuggestions = async () => {
    try {
      const postsApi = (await import('../../services/postsApi')).default;
      const response = await postsApi.getPostSuggestions(5);
      setSuggestions(response.suggestions || []);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  };

  const fetchTrending = async () => {
    try {
      const postsApi = (await import('../../services/postsApi')).default;
      const response = await postsApi.getTrendingPosts(1, 5, '24h');
      setTrendingPosts(response.posts || []);
    } catch (error) {
      console.error('Failed to fetch trending:', error);
    }
  };

  const fetchRankings = async () => {
    try {
      setLoadingRankings(true);
      const response = await userApi.getRankings('weekly');
      setRankings(response.slice(0, 3)); // Only show top 3
    } catch (error) {
      console.error('Failed to fetch rankings:', error);
    } finally {
      setLoadingRankings(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshFeed();
    setDisplayedPosts(posts.slice(0, 5));
    setRefreshing(false);
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || displayedPosts.length >= posts.length) return;
    
    setLoadingMore(true);
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    const nextBatch = posts.slice(displayedPosts.length, displayedPosts.length + 5);
    setDisplayedPosts(prev => [...prev, ...nextBatch]);
    setLoadingMore(false);
  }, [loadingMore, displayedPosts.length, posts]);

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return '#FCD34D'; // yellow-300
      case 2: return '#9CA3AF'; // gray-400
      case 3: return '#FB923C'; // orange-400
      default: return '#E5E7EB';
    }
  };

  const colors = isDark ? {
    bg: theme.colors.dark.bg,
    card: theme.colors.dark.card,
    text: theme.colors.dark.text,
    gray500: '#6B7280',
  } : {
    background: '#f8fafc',
    card: '#FFFFFF',
    text: '#111827',
    gray500: '#6B7280',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'background' in colors ? colors.background : colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => setMoreSheetVisible(true)}
        >
          <Ionicons name="menu" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Home</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/search' as any)}
          >
            <Ionicons name="search" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => router.push('/notifications' as any)}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={toggleDarkMode}
          >
            <Ionicons name={isDark ? "sunny" : "moon"} size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 20;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            if (!loadingMore && displayedPosts.length < posts.length) {
              loadMore();
            }
          }
        }}
        scrollEventThrottle={400}
      >
        {/* Stories */}
        <StoryRow stories={stories} />

        {/* Featured Post */}
        {featuredPost && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star" size={20} color="#FBBF24" />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Featured</Text>
            </View>
            <PostCard post={featuredPost} />
          </View>
        )}

        {/* Store Teaser */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bag-handle" size={20} color={theme.colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Fashion Store</Text>
          </View>
          
          <View style={styles.storeGrid}>
            {storeItems.slice(0, 4).map((item) => (
              <TouchableOpacity 
                key={item.id}
                style={[styles.storeItem, { backgroundColor: colors.card }]}
                onPress={() => router.push(`/product/${item.id}` as any)}
              >
                <Image source={{ uri: item.images[0] }} style={styles.storeItemImage} />
                <View style={styles.storeItemInfo}>
                  <Text style={[styles.storeItemName, { color: colors.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[styles.storeItemPrice, { color: currentColors.primary }]}>
                    ₵{item.price}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          
          <TouchableOpacity 
            style={[styles.viewAllButton, { backgroundColor: currentColors.primary }]}
            onPress={() => router.push('/store' as any)}
          >
            <Text style={styles.viewAllButtonText}>View All Items</Text>
          </TouchableOpacity>
        </View>

        {/* Rankings Teaser */}
        {isPremium ? (
          <View style={styles.section}>
            <View style={styles.rankingHeader}>
              <View style={styles.rankingHeaderLeft}>
                <Ionicons name="trophy" size={20} color="#F59E0B" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  This Week's Top Creators
                </Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/rankings' as any)}>
                <Text style={[styles.viewAllLink, { color: currentColors.primary }]}>
                  View all →
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Top 3 Rankings */}
            <View style={styles.rankingsTeaser}>
              {loadingRankings ? (
                <ActivityIndicator color={currentColors.primary} />
              ) : (
                rankings.map((ranking: any, index: number) => (
                  <View
                    key={ranking.userId || index}
                    style={[styles.rankingItem, { backgroundColor: colors.card }]}
                  >
                    <View
                      style={[
                        styles.rankingBadge,
                        { backgroundColor: getRankColor(index + 1) }
                      ]}
                    >
                      <Text style={styles.rankingBadgeText}>{index + 1}</Text>
                    </View>
                    <Avatar uri={ranking.avatar} size={32} />
                    <View style={styles.rankingUserInfo}>
                      <Text style={[styles.rankingUserName, { color: colors.text }]}>
                        {ranking.name}
                      </Text>
                      <Text style={[styles.rankingScore, { color: colors.gray500 || '#6B7280' }]}>
                        {ranking.score} pts
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Prize Pool Card */}
            <View style={[styles.prizePoolCard, isDark ? styles.prizePoolCardDark : styles.prizePoolCardLight]}>
              <View style={styles.prizePoolContent}>
                <View>
                  <Text style={[styles.prizePoolTitle, isDark ? styles.prizePoolTitleDark : styles.prizePoolTitleLight]}>
                    💰 Monthly Prize Pool
                  </Text>
                  <Text style={[styles.prizePoolSubtitle, isDark ? styles.prizePoolSubtitleDark : styles.prizePoolSubtitleLight]}>
                    ₵150 total rewards this month
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => router.push('/rankings' as any)}
                  style={styles.competeButton}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#F97316']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.competeButtonGradient}
                  >
                    <Ionicons name="trophy" size={14} color="white" />
                    <Text style={styles.competeButtonText}>Compete</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.rankingCTACard, { backgroundColor: colors.card }]}>
            <View style={styles.rankingCTAContent}>
              <View style={[styles.rankingIcon, { backgroundColor: '#8B5CF6' }]}>
                <Ionicons name="trophy" size={24} color="white" />
              </View>
              <View style={styles.rankingCTAText}>
                <Text style={[styles.rankingCTATitle, { color: colors.text }]}>
                  Join the Competition!
                </Text>
                <Text style={[styles.rankingCTASubtitle, { color: colors.gray500 || '#6B7280' }]}>
                  Compete for ₵150 monthly prizes
                </Text>
              </View>
              <TouchableOpacity 
                style={[styles.upgradeButton, { backgroundColor: '#8B5CF6' }]}
                onPress={() => router.push('/subscription' as any)}
              >
                <Ionicons name="star" size={16} color="white" />
                <Text style={styles.upgradeButtonText}>Upgrade</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Post Suggestions */}
        {suggestions.length > 0 && showSuggestions && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="sparkles" size={20} color="#8B5CF6" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Suggested for You
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowSuggestions(false)}>
                <Ionicons name="close" size={18} color={colors.gray500 || '#6B7280'} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {suggestions.map((suggestion: any) => (
                <TouchableOpacity
                  key={suggestion.id}
                  style={[styles.suggestionCard, { backgroundColor: colors.card }]}
                  onPress={() => router.push(`/post/${suggestion.id}` as any)}
                >
                  <Image
                    source={{ uri: suggestion.media?.url || suggestion.media?.thumbnail || '' }}
                    style={styles.suggestionImage}
                  />
                  <View style={styles.suggestionInfo}>
                    <Text style={[styles.suggestionUser, { color: colors.text }]} numberOfLines={1}>
                      {suggestion.user?.name || 'User'}
                    </Text>
                    <View style={styles.suggestionStats}>
                      <Ionicons name="heart" size={12} color="#EF4444" />
                      <Text style={[styles.suggestionStatText, { color: colors.gray500 || '#6B7280' }]}>
                        {suggestion.likesCount || 0}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Trending Posts */}
        {trendingPosts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="flame" size={20} color="#F59E0B" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Trending Now
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowTrending(!showTrending)}>
                <Ionicons 
                  name={showTrending ? "chevron-up" : "chevron-down"} 
                  size={18} 
                  color={colors.gray500 || '#6B7280'} 
                />
              </TouchableOpacity>
            </View>
            {showTrending && (
              <View style={styles.trendingContainer}>
                {trendingPosts.slice(0, 3).map((post: any) => (
                  <PostCard key={post.id} post={post} />
                ))}
                {trendingPosts.length > 3 && (
                  <TouchableOpacity
                    style={[styles.viewMoreButton, { backgroundColor: colors.card }]}
                    onPress={() => {
                      // Navigate to trending view
                      router.push('/trending' as any);
                    }}
                  >
                    <Text style={[styles.viewMoreText, { color: currentColors.primary }]}>
                      View More Trending →
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Feed */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 16 }]}>
            Your Feed
          </Text>
          <View style={styles.feed}>
            {displayedPosts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
          </View>
          
          {displayedPosts.length < posts.length && (
            <TouchableOpacity 
              style={[styles.loadMoreButton, { backgroundColor: colors.card }]}
              onPress={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator color={currentColors.primary} />
              ) : (
                <Text style={[styles.loadMoreText, { color: currentColors.primary }]}>
                  Load More
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* More Sheet */}
      <MoreSheet
        visible={moreSheetVisible}
        onClose={() => setMoreSheetVisible(false)}
      />

      {/* Floating Action Buttons */}
      <FloatingActionButtons />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    padding: theme.spacing[2],
  },
  headerTitle: {
    fontSize: theme.typography.fontSize[18],
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.spacing[2],
  },
  section: {
    padding: theme.spacing[4],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing[2],
    marginBottom: theme.spacing[3],
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    flex: 1,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize[16],
    fontWeight: theme.typography.fontWeight.bold,
    flex: 1,
  },
  storeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing[3],
    marginBottom: theme.spacing[3],
  },
  storeItem: {
    width: '47%',
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  storeItemImage: {
    width: '100%',
    height: 120,
  },
  storeItemInfo: {
    padding: theme.spacing[2],
  },
  storeItemName: {
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: theme.spacing[1],
  },
  storeItemPrice: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.extrabold,
  },
  viewAllButton: {
    paddingVertical: theme.spacing[3],
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
  },
  viewAllButtonText: {
    color: 'white',
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
  },
  rankingCTACard: {
    margin: theme.spacing[4],
    padding: theme.spacing[4],
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: '#8B5CF640',
  },
  rankingCTAContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  rankingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankingCTAText: {
    flex: 1,
  },
  rankingCTATitle: {
    fontSize: theme.typography.fontSize[16],
    fontWeight: theme.typography.fontWeight.bold,
    marginBottom: 2,
  },
  rankingCTASubtitle: {
    fontSize: theme.typography.fontSize[12],
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.xl,
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.semibold,
  },
  feed: {
    gap: theme.spacing[4],
  },
  loadMoreButton: {
    paddingVertical: theme.spacing[3],
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: theme.spacing[4],
  },
  loadMoreText: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
  },
  horizontalScroll: {
    marginHorizontal: -theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
  },
  suggestionCard: {
    width: 120,
    marginRight: theme.spacing[3],
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#F3F4F6',
  },
  suggestionInfo: {
    padding: theme.spacing[2],
  },
  suggestionUser: {
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: theme.spacing[1],
  },
  suggestionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1],
  },
  suggestionStatText: {
    fontSize: theme.typography.fontSize[11],
  },
  trendingContainer: {
    gap: theme.spacing[3],
  },
  viewMoreButton: {
    paddingVertical: theme.spacing[3],
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: theme.spacing[2],
  },
  viewMoreText: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
  },
  rankingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing[2],
  },
  rankingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    flex: 1,
  },
  viewAllLink: {
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.medium,
  },
  rankingsTeaser: {
    gap: theme.spacing[2],
    marginBottom: theme.spacing[3],
  },
  rankingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    padding: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
  },
  rankingBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankingBadgeText: {
    color: 'white',
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.bold,
  },
  rankingUserInfo: {
    flex: 1,
  },
  rankingUserName: {
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.semibold,
  },
  rankingScore: {
    fontSize: theme.typography.fontSize[12],
  },
  prizePoolCard: {
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
  },
  prizePoolCardLight: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  prizePoolCardDark: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  prizePoolContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prizePoolTitle: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
    marginBottom: 2,
  },
  prizePoolTitleLight: {
    color: '#92400E',
  },
  prizePoolTitleDark: {
    color: '#FCD34D',
  },
  prizePoolSubtitle: {
    fontSize: theme.typography.fontSize[12],
  },
  prizePoolSubtitleLight: {
    color: '#A16207',
  },
  prizePoolSubtitleDark: {
    color: '#FDE68A',
  },
  competeButton: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  competeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1.5],
  },
  competeButtonText: {
    color: 'white',
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.medium,
  },
});
