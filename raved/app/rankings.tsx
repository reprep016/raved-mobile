import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { useStore } from '../hooks/useStore';
import { rankingsApi, RankingsResponse, RankingUser } from '../services/rankingsApi';

type RankingPeriod = 'weekly' | 'monthly' | 'all-time';

const periodFilters: { id: RankingPeriod; label: string }[] = [
  { id: 'weekly', label: 'This Week' },
  { id: 'monthly', label: 'This Month' },
  { id: 'all-time', label: 'All Time' },
];

export default function RankingsScreen() {
  const router = useRouter();
  const { isPremium } = useStore();
  const [activePeriod, setActivePeriod] = useState<RankingPeriod>('weekly');
  const [rankingsData, setRankingsData] = useState<RankingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRankings();
  }, [activePeriod]);

  const loadRankings = async () => {
    try {
      setLoading(true);
      const data = await rankingsApi.getRankings(activePeriod);
      setRankingsData(data);
    } catch (error) {
      console.error('Failed to load rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRankings();
    setRefreshing(false);
  };

  const top3 = rankingsData?.rankings.slice(0, 3) || [];
  const rest = rankingsData?.rankings.slice(3) || [];

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return '#FCD34D';
      case 2:
        return '#9CA3AF';
      case 3:
        return '#FB923C';
      default:
        return '#E5E7EB';
    }
  };

  const getPodiumHeight = (rank: number) => {
    switch (rank) {
      case 1:
        return 96;
      case 2:
        return 80;
      case 3:
        return 64;
      default:
        return 0;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.handle} />
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🏆 Creator Rankings</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Prize Pool */}
        {rankingsData && (
          <View style={styles.prizeCard}>
            <Text style={styles.prizeAmount}>
              ₵{rankingsData.prizePool.weekly.toFixed(2)} Prize Pool
            </Text>
            <Text style={styles.prizeSubtitle}>
              {activePeriod === 'weekly' ? "This week's" : activePeriod === 'monthly' ? "This month's" : "All time"} total rewards
            </Text>
            {activePeriod === 'weekly' && (
              <Text style={styles.prizeBreakdown}>
                🥇 1st Place: ₵75 • 🥈 2nd Place: ₵45 • 🥉 3rd Place: ₵30
              </Text>
            )}
            {activePeriod === 'monthly' && (
              <Text style={styles.prizeBreakdown}>
                🥇 1st Place: ₵300 • 🥈 2nd Place: ₵180 • 🥉 3rd Place: ₵120
              </Text>
            )}
          </View>
        )}

        {/* Period Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filtersContent}
        >
          {periodFilters.map(filter => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterPill,
                activePeriod === filter.id && styles.filterPillActive,
              ]}
              onPress={() => {
                setActivePeriod(filter.id);
              }}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activePeriod === filter.id && styles.filterPillTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Top 3 Podium */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : top3.length > 0 ? (
          <View style={styles.podiumSection}>
            <Text style={styles.sectionTitle}>
              🏆 Top 3 {activePeriod === 'weekly' ? 'This Week' : activePeriod === 'monthly' ? 'This Month' : 'All Time'}
            </Text>
            <View style={styles.podium}>
              {/* 2nd Place */}
              {top3[1] && (
                <View style={styles.podiumItem}>
                  <View style={[styles.podiumBase, { height: getPodiumHeight(2), backgroundColor: '#9CA3AF' }]}>
                    <Text style={styles.podiumRank}>2</Text>
                  </View>
                  <Avatar uri={top3[1].avatar || ''} size={48} />
                  <Text style={styles.podiumName}>{top3[1].name}</Text>
                  <Text style={styles.podiumScore}>{top3[1].score.toLocaleString()} pts</Text>
                </View>
              )}

              {/* 1st Place */}
              {top3[0] && (
                <View style={styles.podiumItem}>
                  <View style={[styles.podiumBase, { height: getPodiumHeight(1), backgroundColor: '#FCD34D' }]}>
                    <Text style={styles.podiumRank}>1</Text>
                  </View>
                  <Avatar uri={top3[0].avatar || ''} size={56} />
                  <Text style={styles.podiumName}>{top3[0].name}</Text>
                  <Text style={styles.podiumScore}>{top3[0].score.toLocaleString()} pts</Text>
                  <View style={styles.championBadge}>
                    <Text style={styles.championText}>👑 Champion</Text>
                  </View>
                </View>
              )}

              {/* 3rd Place */}
              {top3[2] && (
                <View style={styles.podiumItem}>
                  <View style={[styles.podiumBase, { height: getPodiumHeight(3), backgroundColor: '#FB923C' }]}>
                    <Text style={styles.podiumRank}>3</Text>
                  </View>
                  <Avatar uri={top3[2].avatar || ''} size={48} />
                  <Text style={styles.podiumName}>{top3[2].name}</Text>
                  <Text style={styles.podiumScore}>{top3[2].score.toLocaleString()} pts</Text>
                </View>
              )}
            </View>
          </View>
        ) : null}

        {/* Full Rankings List */}
        {rest.length > 0 && (
          <View style={styles.rankingsSection}>
            <Text style={styles.sectionTitle}>📊 Complete Rankings</Text>
            {rest.map((ranking) => (
              <View key={ranking.userId} style={styles.rankingCard}>
                <View style={[styles.rankBadge, { backgroundColor: getRankColor(ranking.rank) }]}>
                  <Text style={styles.rankNumber}>{ranking.rank}</Text>
                </View>
                <Avatar uri={ranking.avatar || ''} size={40} />
                <View style={styles.rankingInfo}>
                  <Text style={styles.rankingName}>{ranking.name}</Text>
                  <Text style={styles.rankingFaculty}>@{ranking.username}</Text>
                </View>
                <Text style={styles.rankingScore}>{ranking.score.toLocaleString()} pts</Text>
              </View>
            ))}
          </View>
        )}

        {/* Scoring System */}
        {rankingsData && (
          <View style={styles.scoringCard}>
            <Text style={styles.scoringTitle}>📈 How Scoring Works</Text>
            <View style={styles.scoringList}>
              <View style={styles.scoringItem}>
                <Text style={styles.scoringLabel}>Post Like</Text>
                <Text style={styles.scoringValue}>+{rankingsData.scoringSystem.postLike} points</Text>
              </View>
              <View style={styles.scoringItem}>
                <Text style={styles.scoringLabel}>Post Comment</Text>
                <Text style={styles.scoringValue}>+{rankingsData.scoringSystem.postComment} points</Text>
              </View>
              <View style={styles.scoringItem}>
                <Text style={styles.scoringLabel}>Post Share</Text>
                <Text style={styles.scoringValue}>+{rankingsData.scoringSystem.postShare} points</Text>
              </View>
              <View style={styles.scoringItem}>
                <Text style={styles.scoringLabel}>Store Item Sale</Text>
                <Text style={styles.scoringValue}>+{rankingsData.scoringSystem.itemSale} points</Text>
              </View>
              <View style={styles.scoringItem}>
                <Text style={styles.scoringLabel}>Weekly Feature</Text>
                <Text style={styles.scoringValue}>+{rankingsData.scoringSystem.weeklyFeature} points</Text>
              </View>
            </View>
          </View>
        )}

        {/* Subscription CTA for Free Users */}
        {!isPremium && (
          <View style={styles.ctaCard}>
            <Text style={styles.ctaTitle}>Join the Competition!</Text>
            <Text style={styles.ctaDescription}>
              Subscribe to Premium to participate in rankings and win cash prizes
            </Text>
            <Button
              title="Subscribe Now"
              onPress={() => router.push('/subscription' as any)}
              variant="primary"
              size="large"
              leftIcon={<Ionicons name="diamond" size={16} color="white" />}
              style={styles.ctaButton}
            />
          </View>
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
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[4],
  },
  headerTitle: {
    fontSize: theme.typography.fontSize[20],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#111827',
  },
  scrollView: {
    flex: 1,
    padding: theme.spacing[4],
  },
  prizeCard: {
    backgroundColor: '#FEF9C3',
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing[4],
    borderWidth: 1,
    borderColor: '#FCD34D',
    alignItems: 'center',
    marginBottom: theme.spacing[6],
  },
  prizeAmount: {
    fontSize: theme.typography.fontSize[24],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#92400E',
    marginBottom: theme.spacing[1],
  },
  prizeSubtitle: {
    fontSize: theme.typography.fontSize[12],
    color: '#A16207',
    marginBottom: theme.spacing[2],
  },
  prizeBreakdown: {
    fontSize: theme.typography.fontSize[10],
    color: '#A16207',
    textAlign: 'center',
  },
  filtersScroll: {
    marginBottom: theme.spacing[6],
  },
  filtersContent: {
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
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
  podiumSection: {
    marginBottom: theme.spacing[6],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize[16],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#111827',
    marginBottom: theme.spacing[4],
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: theme.spacing[4],
    marginBottom: theme.spacing[6],
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
  },
  podiumBase: {
    width: 64,
    borderRadius: theme.borderRadius.lg,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: theme.spacing[2],
    marginBottom: theme.spacing[2],
  },
  podiumRank: {
    color: 'white',
    fontSize: theme.typography.fontSize[16],
    fontWeight: theme.typography.fontWeight.bold,
  },
  podiumName: {
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#111827',
    marginTop: theme.spacing[1],
  },
  podiumScore: {
    fontSize: theme.typography.fontSize[10],
    color: '#6B7280',
  },
  championBadge: {
    marginTop: theme.spacing[1],
  },
  championText: {
    fontSize: theme.typography.fontSize[10],
    color: '#FCD34D',
    fontWeight: theme.typography.fontWeight.medium,
  },
  rankingsSection: {
    marginBottom: theme.spacing[6],
  },
  rankingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing[3],
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: theme.spacing[3],
    gap: theme.spacing[3],
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.bold,
    color: 'white',
  },
  rankingInfo: {
    flex: 1,
  },
  rankingName: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#111827',
    marginBottom: 2,
  },
  rankingFaculty: {
    fontSize: theme.typography.fontSize[12],
    color: '#6B7280',
  },
  rankingScore: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary,
  },
  scoringCard: {
    backgroundColor: '#DBEAFE',
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing[4],
    marginBottom: theme.spacing[6],
  },
  scoringTitle: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#1E40AF',
    marginBottom: theme.spacing[3],
  },
  scoringList: {
    gap: theme.spacing[2],
  },
  scoringItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoringLabel: {
    fontSize: theme.typography.fontSize[12],
    color: '#1E40AF',
  },
  scoringValue: {
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.medium,
    color: '#1E40AF',
  },
  ctaCard: {
    backgroundColor: '#F3E8FF',
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing[4],
    borderWidth: 1,
    borderColor: '#A855F7',
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: theme.typography.fontSize[18],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#6D28D9',
    marginBottom: theme.spacing[2],
  },
  ctaDescription: {
    fontSize: theme.typography.fontSize[12],
    color: '#7C3AED',
    textAlign: 'center',
    marginBottom: theme.spacing[3],
  },
  ctaButton: {
    width: '100%',
  },
  loadingContainer: {
    paddingVertical: theme.spacing[12],
    alignItems: 'center',
  },
});

