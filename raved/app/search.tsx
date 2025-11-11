import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { usePosts } from '../hooks/usePosts';
import { mockUsers } from '../utils/mockData';
import { Post } from '../types';
import { searchApi, SearchResult } from '../services/searchApi';

type SearchFilter = 'all' | 'users' | 'posts' | 'tags';

export default function SearchScreen() {
  const router = useRouter();
  const { posts } = usePosts();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const searchFilters: { id: SearchFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'users', label: 'Users' },
    { id: 'posts', label: 'Posts' },
    { id: 'tags', label: 'Tags' },
  ];

  // Perform search when query changes
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) {
        setSearchResults(null);
        return;
      }

      try {
        setLoading(true);
        const typeMap: Record<SearchFilter, 'all' | 'users' | 'posts' | 'tags' | 'items' | 'events'> = {
          all: 'all',
          users: 'users',
          posts: 'posts',
          tags: 'tags',
        };
        
        const response = await searchApi.advancedSearch(
          searchQuery,
          typeMap[activeFilter] || 'all',
          undefined,
          'relevance',
          1,
          20
        );
        
        setSearchResults(response.results);
      } catch (error) {
        console.error('Search error:', error);
        // Fallback to local search on error
        const query = searchQuery.toLowerCase();
        const userResults = mockUsers.filter(user =>
          user.name.toLowerCase().includes(query) ||
          user.faculty.toLowerCase().includes(query)
        );
        const postResults = posts.filter(post =>
          post.caption.toLowerCase().includes(query) ||
          post.user.name.toLowerCase().includes(query)
        );
        const tagResults = Array.from(
          new Set(
            posts
              .flatMap(post => post.tags || [])
              .filter(tag => tag.toLowerCase().includes(query))
          )
        );
        setSearchResults({ users: userResults, posts: postResults, tags: tagResults });
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, activeFilter, posts]);

  const getDisplayResults = () => {
    if (!searchResults) return { users: [], posts: [], tags: [] };
    
    switch (activeFilter) {
      case 'users':
        return searchResults.users || [];
      case 'posts':
        return searchResults.posts || [];
      case 'tags':
        return searchResults.tags || [];
      default:
        return {
          users: (searchResults.users || []).slice(0, 3),
          posts: (searchResults.posts || []).slice(0, 3),
          tags: (searchResults.tags || []).slice(0, 3),
        };
    }
  };

  const renderUserResult = (user: { id: string; name: string; avatar?: string; faculty?: string; username?: string }) => (
    <TouchableOpacity
      key={user.id}
      style={styles.resultCard}
      onPress={() => {}}
    >
      <Avatar uri={user.avatar || ''} size={40} />
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle}>{user.name}</Text>
        <Text style={styles.resultSubtitle}>{user.faculty}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const renderPostResult = (post: Post) => (
    <TouchableOpacity
      key={post.id}
      style={styles.resultCard}
      onPress={() => router.push(`/post/${post.id}` as any)}
    >
      <Image
        source={{ uri: post.media.url || post.media.thumbnail || post.media.items?.[0] || '' }}
        style={styles.postThumbnail}
      />
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={1}>
          {post.user.name}
        </Text>
        <Text style={styles.resultSubtitle} numberOfLines={2}>
          {post.caption}
        </Text>
        {post.media.type === 'video' && (
          <View style={styles.mediaBadge}>
            <Text style={styles.mediaBadgeText}>🔹 Video</Text>
          </View>
        )}
        {post.media.type === 'carousel' && post.media.items && (
          <View style={styles.mediaBadge}>
            <Text style={styles.mediaBadgeText}>
              🖼️ {post.media.items.length} photos
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const renderTagResult = (tag: string) => (
    <TouchableOpacity
      key={tag}
      style={styles.resultCard}
      onPress={() => {}}
    >
      <View style={styles.tagIcon}>
        <Ionicons name="pricetag" size={20} color={theme.colors.primary} />
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle}>#{tag}</Text>
        <Text style={styles.resultSubtitle}>
          {posts.filter(p => p.tags?.includes(tag)).length} posts
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const results = getDisplayResults();
  const hasResults = activeFilter === 'all'
    ? ((results as any).users?.length > 0 || (results as any).posts?.length > 0 || (results as any).tags?.length > 0)
    : (Array.isArray(results) && results.length > 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.handle} />
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users, tags, posts..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
        >
          {searchFilters.map(filter => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterPill,
                activeFilter === filter.id && styles.filterPillActive,
              ]}
              onPress={() => setActiveFilter(filter.id)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeFilter === filter.id && styles.filterPillTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results */}
      <ScrollView style={styles.results} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : !hasResults && searchQuery.trim() ? (
          <EmptyState
            icon="search-outline"
            title="No results found"
          />
        ) : !searchQuery.trim() ? (
          <EmptyState
            icon="search-outline"
            title="Start typing to search"
          />
        ) : activeFilter === 'all' ? (
          <>
            {(results as any).users?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Users</Text>
                {(results as any).users.map(renderUserResult)}
              </View>
            )}
            {(results as any).posts?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Posts</Text>
                {(results as any).posts.map(renderPostResult)}
              </View>
            )}
            {(results as any).tags?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tags</Text>
                {(results as any).tags.map(renderTagResult)}
              </View>
            )}
          </>
        ) : activeFilter === 'users' ? (
          Array.isArray(results) ? results.map(renderUserResult) : null
        ) : activeFilter === 'posts' ? (
          Array.isArray(results) ? results.map(renderPostResult) : null
        ) : (
          Array.isArray(results) ? results.map(renderTagResult) : null
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: theme.spacing[2],
    paddingBottom: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: theme.spacing[2],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.spacing[4],
    marginBottom: theme.spacing[3],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[3],
    borderRadius: theme.borderRadius['2xl'],
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: theme.spacing[2],
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSize[18],
    color: '#111827',
  },
  clearButton: {
    padding: theme.spacing[1],
  },
  filtersScroll: {
    marginHorizontal: theme.spacing[4],
  },
  filtersContent: {
    gap: theme.spacing[2],
  },
  filterPill: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.full,
    backgroundColor: '#F3F4F6',
  },
  filterPillActive: {
    backgroundColor: theme.colors.primary,
  },
  filterPillText: {
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.medium,
    color: '#374151',
  },
  filterPillTextActive: {
    color: 'white',
  },
  results: {
    flex: 1,
    padding: theme.spacing[4],
  },
  section: {
    marginBottom: theme.spacing[6],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#6B7280',
    marginBottom: theme.spacing[3],
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing[3],
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: theme.spacing[2],
    gap: theme.spacing[3],
  },
  postThumbnail: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.base,
  },
  tagIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.medium,
    color: '#111827',
    marginBottom: 2,
  },
  resultSubtitle: {
    fontSize: theme.typography.fontSize[12],
    color: '#6B7280',
  },
  mediaBadge: {
    marginTop: 4,
  },
  mediaBadgeText: {
    fontSize: theme.typography.fontSize[10],
    color: theme.colors.primary,
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing[12],
  },
  loadingText: {
    fontSize: theme.typography.fontSize[14],
    color: '#6B7280',
  },
});

