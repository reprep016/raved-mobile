import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { Avatar } from '../components/ui/Avatar';
import { useStore } from '../hooks/useStore';
import { useAuth } from '../hooks/useAuth';
import { StoreItem } from '../types';
import { storeApi } from '../services/storeApi';
import { EmptyState } from '../components/ui/EmptyState';

export default function SellerDashboardScreen() {
  const router = useRouter();
  const { isPremium } = useStore();
  const { user } = useAuth();
  const [myItems, setMyItems] = useState<StoreItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPremium) {
      Alert.alert(
        'Premium Required',
        'Seller dashboard is only available for premium members.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
          {
            text: 'Upgrade',
            onPress: () => {
              router.back();
              router.push('/subscription' as any);
            },
          },
        ]
      );
      return;
    }

    loadMyItems();
  }, [isPremium, user?.id]);

  const loadMyItems = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const response = await storeApi.getStoreItems({ page: 1, limit: 100 });
      
      // Filter items by current user
      const userItems = response.items.filter(
        (item: StoreItem) => item.seller.id === user.id
      );
      
      setMyItems(userItems);
      setTotalItems(userItems.length);
      
      // Calculate total sales from sales_count
      const sales = userItems.reduce((sum: number, item: StoreItem) => {
        const salesCount = (item as any).salesCount || 0;
        return sum + (salesCount * item.price);
      }, 0);
      setTotalSales(sales);
    } catch (error) {
      console.error('Failed to load my items:', error);
      setMyItems([]);
      setTotalItems(0);
      setTotalSales(0);
    } finally {
      setLoading(false);
    }
  };

  if (!isPremium) {
    return null;
  }

  const handleAddItem = () => {
    router.push('/add-item' as any);
  };

  const handleViewItem = (itemId: string) => {
    router.back();
    router.push(`/product/${itemId}` as any);
  };

  const handleEditItem = (itemId: string) => {
    Alert.alert('Coming Soon', 'Item editing feature coming soon!');
  };

  const handleDiscount = (itemId: string) => {
    Alert.alert('Coming Soon', 'Discount feature coming soon!');
  };

  const handleRefresh = () => {
    loadMyItems();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🏪 My Store Dashboard</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Store Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardBlue]}>
            <View style={styles.statCardContent}>
              <View>
                <Text style={styles.statValue}>{totalItems}</Text>
                <Text style={styles.statLabel}>Total Items</Text>
              </View>
              <Ionicons name="cube" size={32} color="#2563EB" />
            </View>
          </View>
          
          <View style={[styles.statCard, styles.statCardGreen]}>
            <View style={styles.statCardContent}>
              <View>
                <Text style={styles.statValueGreen}>₵{totalSales.toFixed(2)}</Text>
                <Text style={styles.statLabelGreen}>Total Sales</Text>
              </View>
              <Ionicons name="trending-up" size={32} color="#16A34A" />
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleAddItem}
            >
              <LinearGradient
                colors={[theme.colors.primary, '#9333EA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionButtonGradient}
              >
                <Ionicons name="add" size={24} color="white" />
                <Text style={styles.actionButtonText}>Add New Item</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/store' as any)}
            >
              <LinearGradient
                colors={['#F97316', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionButtonGradient}
              >
                <Ionicons name="pricetag" size={24} color="white" />
                <Text style={styles.actionButtonText}>Bulk Discount</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* My Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Items</Text>
            <TouchableOpacity onPress={handleRefresh}>
              <Ionicons name="refresh" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {myItems.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="No items in your store yet"
              actionLabel="Add Your First Item"
              onAction={handleAddItem}
            />
          ) : (
            <View style={styles.itemsList}>
              {myItems.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  <Image
                    source={{ uri: item.images[0] }}
                    style={styles.itemImage}
                  />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemDetails}>
                      ₵{item.price} • {item.condition}
                    </Text>
                    <Text style={styles.itemSales}>
                      {Math.floor(Math.random() * 10)} sales
                    </Text>
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity
                      style={[styles.itemActionButton, styles.viewButton]}
                      onPress={() => handleViewItem(item.id)}
                    >
                      <Ionicons name="open-outline" size={14} color="#16A34A" />
                      <Text style={styles.viewButtonText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.itemActionButton, styles.editButton]}
                      onPress={() => handleEditItem(item.id)}
                    >
                      <Ionicons name="create-outline" size={14} color="#2563EB" />
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.itemActionButton, styles.discountButton]}
                      onPress={() => handleDiscount(item.id)}
                    >
                      <Ionicons name="pricetag-outline" size={14} color="#F97316" />
                      <Text style={styles.discountButtonText}>Discount</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[2],
    paddingBottom: theme.spacing[3],
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: theme.typography.fontSize[20],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#111827',
  },
  closeButton: {
    padding: theme.spacing[1],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing[4],
    gap: theme.spacing[6],
  },
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing[4],
  },
  statCard: {
    flex: 1,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing[4],
    borderWidth: 1,
  },
  statCardBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statCardGreen: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statValue: {
    fontSize: theme.typography.fontSize[24],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#1E40AF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: theme.typography.fontSize[14],
    color: '#1E3A8A',
  },
  statValueGreen: {
    fontSize: theme.typography.fontSize[24],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#166534',
    marginBottom: 4,
  },
  statLabelGreen: {
    fontSize: theme.typography.fontSize[14],
    color: '#15803D',
  },
  section: {
    gap: theme.spacing[3],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize[16],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#374151',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: theme.spacing[3],
  },
  actionButton: {
    flex: 1,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    padding: theme.spacing[4],
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  actionButtonText: {
    color: 'white',
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.medium,
  },
  itemsList: {
    gap: theme.spacing[3],
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing[4],
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.lg,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#111827',
  },
  itemDetails: {
    fontSize: theme.typography.fontSize[14],
    color: '#6B7280',
  },
  itemSales: {
    fontSize: theme.typography.fontSize[12],
    color: '#9CA3AF',
  },
  itemActions: {
    flexDirection: 'column',
    gap: theme.spacing[2],
  },
  itemActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.borderRadius.lg,
  },
  viewButton: {
    backgroundColor: '#D1FAE5',
  },
  viewButtonText: {
    color: '#16A34A',
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.medium,
  },
  editButton: {
    backgroundColor: '#DBEAFE',
  },
  editButtonText: {
    color: '#2563EB',
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.medium,
  },
  discountButton: {
    backgroundColor: '#FED7AA',
  },
  discountButtonText: {
    color: '#F97316',
    fontSize: theme.typography.fontSize[12],
    fontWeight: theme.typography.fontWeight.medium,
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
  emptyButton: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.primary,
    marginTop: theme.spacing[2],
  },
  emptyButtonText: {
    color: 'white',
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
  },
});

