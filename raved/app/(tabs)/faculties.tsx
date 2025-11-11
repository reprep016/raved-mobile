import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { PostCard } from '../../components/posts/PostCard';
import { useAuth } from '../../hooks/useAuth';
import { Post } from '../../types';
import { facultiesApi, Faculty } from '../../services/facultiesApi';
import { postsApi } from '../../services/postsApi';

const facultyIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  'arts': 'color-palette',
  'business': 'briefcase',
  'engineering': 'construct',
  'science': 'flask',
  'medicine': 'medical',
  'law': 'scale',
  'education': 'school',
  'default': 'school',
};

const facultyColors: Record<string, string[]> = {
  'arts': ['#A855F7', '#EC4899'],
  'business': ['#3B82F6', '#06B6D4'],
  'engineering': ['#F97316', '#EF4444'],
  'science': ['#10B981', '#059669'],
  'medicine': ['#EF4444', '#EC4899'],
  'law': ['#6366F1', '#A855F7'],
  'education': ['#F59E0B', '#F97316'],
};

export default function FacultiesScreen() {
  const { user } = useAuth();
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState<string | null>(null);
  const [facultyStats, setFacultyStats] = useState<{ memberCount: number; postCount: number; eventCount: number } | null>(null);
  const [facultyPosts, setFacultyPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadFaculties();
  }, []);

  useEffect(() => {
    if (selectedFaculty) {
      loadFacultyData(selectedFaculty);
    } else {
      setFacultyStats(null);
      setFacultyPosts([]);
    }
  }, [selectedFaculty]);

  const loadFaculties = async () => {
    try {
      setLoading(true);
      const data = await facultiesApi.getFaculties();
      setFaculties(data);
    } catch (error) {
      console.error('Failed to load faculties:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFacultyData = async (facultyId: string) => {
    try {
      setLoadingPosts(true);
      const [stats, postsData] = await Promise.all([
        facultiesApi.getFacultyStats(facultyId),
        postsApi.getFacultyPosts(facultyId, 1, 20),
      ]);
      setFacultyStats(stats);
      setFacultyPosts(postsData.posts || []);
      setHasMore(postsData.pagination?.hasMore || false);
      setPage(1);
    } catch (error) {
      console.error('Failed to load faculty data:', error);
    } finally {
      setLoadingPosts(false);
    }
  };

  const loadMorePosts = async () => {
    if (!selectedFaculty || loadingPosts || !hasMore) return;
    
    try {
      setLoadingPosts(true);
      const nextPage = page + 1;
      const postsData = await postsApi.getFacultyPosts(selectedFaculty, nextPage, 20);
      setFacultyPosts(prev => [...prev, ...(postsData.posts || [])]);
      setHasMore(postsData.pagination?.hasMore || false);
      setPage(nextPage);
    } catch (error) {
      console.error('Failed to load more posts:', error);
    } finally {
      setLoadingPosts(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFaculties();
    if (selectedFaculty) {
      await loadFacultyData(selectedFaculty);
    }
    setRefreshing(false);
  };

  const getFacultyIcon = (facultyName: string) => {
    const key = facultyName.toLowerCase().split(' ')[0];
    return facultyIcons[key] || facultyIcons.default;
  };

  const getFacultyColor = (facultyName: string) => {
    const key = facultyName.toLowerCase().split(' ')[0];
    return facultyColors[key] || ['#5D5CDE', '#FF6B6B'];
  };

  const currentData = selectedFaculty 
    ? faculties.find(f => f.id === selectedFaculty)
    : null;

  const renderFacultyButton = (faculty: Faculty) => {
    const isSelected = selectedFaculty === faculty.id;
    const colors = getFacultyColor(faculty.name);
    const icon = getFacultyIcon(faculty.name);
    
    return (
      <TouchableOpacity
        key={faculty.id}
        style={[
          styles.facultyButton,
          isSelected && styles.facultyButtonActive,
          !isSelected && {
            backgroundColor: `${colors[0]}20`,
          },
        ]}
        onPress={() => setSelectedFaculty(isSelected ? null : faculty.id)}
      >
        <Ionicons
          name={icon}
          size={20}
          color={isSelected ? 'white' : colors[0]}
        />
        <Text
          style={[
            styles.facultyButtonTitle,
            isSelected && styles.facultyButtonTitleActive,
            !isSelected && { color: colors[0] },
          ]}
          numberOfLines={2}
        >
          {faculty.name}
        </Text>
        <Text
          style={[
            styles.facultyButtonMembers,
            isSelected && styles.facultyButtonMembersActive,
          ]}
        >
          {faculty.memberCount.toLocaleString()} members
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading && faculties.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Faculty Selection */}
        <View style={styles.facultySelection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="school" size={20} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>Campus Communities</Text>
          </View>
          <View style={styles.facultyGrid}>
            {faculties.map(renderFacultyButton)}
          </View>
        </View>

        {/* Faculty Stats */}
        {selectedFaculty && facultyStats && currentData && (
          <View style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{facultyStats.memberCount.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Members</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{facultyStats.postCount.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{facultyStats.eventCount.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Events</Text>
              </View>
            </View>
          </View>
        )}

        {/* Faculty Feed */}
        {selectedFaculty && currentData && (
          <View style={styles.feedSection}>
            <View style={styles.feedHeader}>
              <Ionicons name="flame" size={18} color={theme.colors.accent} />
              <Text style={styles.feedTitle}>
                Trending in {currentData.name}
              </Text>
            </View>

            {loadingPosts && facultyPosts.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : facultyPosts.length > 0 ? (
              <>
                <FlatList
                  data={facultyPosts}
                  renderItem={({ item }) => <PostCard post={item} />}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={{ height: theme.spacing[4] }} />}
                />
                {hasMore && (
                  <TouchableOpacity 
                    style={styles.loadMoreButton}
                    onPress={loadMorePosts}
                    disabled={loadingPosts}
                  >
                    {loadingPosts ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                      <Text style={styles.loadMoreText}>Load More</Text>
                    )}
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>No posts yet in {currentData.name}</Text>
              </View>
            )}
          </View>
        )}

        {!selectedFaculty && (
          <View style={styles.emptyState}>
            <Ionicons name="school-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>Select a faculty to view posts</Text>
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing[12],
  },
  facultySelection: {
    margin: theme.spacing[4],
    padding: theme.spacing[4],
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    marginBottom: theme.spacing[4],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize[18],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#111827',
  },
  facultyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing[3],
  },
  facultyButton: {
    width: '47%',
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    gap: theme.spacing[1],
  },
  facultyButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  facultyButtonTitle: {
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.medium,
    color: '#374151',
    textAlign: 'center',
  },
  facultyButtonTitleActive: {
    color: 'white',
  },
  facultyButtonMembers: {
    fontSize: theme.typography.fontSize[10],
    color: '#6B7280',
    opacity: 0.8,
  },
  facultyButtonMembersActive: {
    color: 'white',
    opacity: 0.8,
  },
  statsCard: {
    margin: theme.spacing[4],
    marginTop: 0,
    padding: theme.spacing[4],
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius['2xl'],
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.typography.fontSize[20],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing[1],
  },
  statLabel: {
    fontSize: theme.typography.fontSize[10],
    color: '#6B7280',
  },
  feedSection: {
    padding: theme.spacing[4],
    paddingTop: 0,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    marginBottom: theme.spacing[3],
  },
  feedTitle: {
    fontSize: theme.typography.fontSize[16],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#111827',
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
  loadMoreButton: {
    marginTop: theme.spacing[4],
    padding: theme.spacing[3],
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary,
  },
});
