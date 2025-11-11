import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import * as Notifications from 'expo-notifications';
import { NotificationService } from '../services/notificationService';
import { notificationsApi, Notification as ApiNotification } from '../services/notificationsApi';
import socketService from '../services/socket';

interface LocalNotification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'sale' | 'message' | 'event';
  user?: {
    id: string;
    name: string;
    avatar: string;
  };
  text: string;
  time: string;
  read: boolean;
  postId?: string;
  itemId?: string;
  eventId?: string;
}

const mockNotifications: LocalNotification[] = [
  {
    id: 'n1',
    type: 'like',
    user: { name: 'Sophie Parker', avatar: 'https://i.imgur.com/bxfE9TV.jpg' },
    text: 'liked your post',
    time: '2m ago',
    read: false,
    postId: 'p1',
  },
  {
    id: 'n2',
    type: 'comment',
    user: { name: 'Emily White', avatar: 'https://i.imgur.com/nV6fsQh.jpg' },
    text: 'commented on your post: "Love this outfit! 🔥"',
    time: '15m ago',
    read: false,
    postId: 'p2',
  },
  {
    id: 'n3',
    type: 'follow',
    user: { name: 'Marcus Stevens', avatar: 'https://i.imgur.com/IigY4Hm.jpg' },
    text: 'started following you',
    time: '1h ago',
    read: true,
  },
  {
    id: 'n4',
    type: 'sale',
    user: { name: 'Anna Reynolds', avatar: 'https://i.imgur.com/KnZQY6W.jpg' },
    text: 'purchased your item "Vintage Denim Jacket"',
    time: '2h ago',
    read: true,
  },
  {
    id: 'n5',
    type: 'mention',
    user: { name: 'David Chen', avatar: 'https://i.imgur.com/kMB0Upu.jpg' },
    text: 'mentioned you in a post',
    time: '3h ago',
    read: true,
    postId: 'p3',
  },
];

const getNotificationIcon = (type: LocalNotification['type']) => {
  switch (type) {
    case 'like':
      return 'heart';
    case 'comment':
      return 'chatbubble';
    case 'follow':
      return 'person-add';
    case 'mention':
      return 'at';
    case 'sale':
      return 'cart';
    default:
      return 'notifications';
  }
};

const getNotificationColor = (type: LocalNotification['type']) => {
  switch (type) {
    case 'like':
      return ['#EC4899', '#F43F5E'];
    case 'comment':
      return ['#3B82F6', '#2563EB'];
    case 'follow':
      return ['#10B981', '#059669'];
    case 'mention':
      return ['#8B5CF6', '#7C3AED'];
    case 'sale':
      return ['#F59E0B', '#D97706'];
    default:
      return [theme.colors.primary, theme.colors.primary];
  }
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<LocalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [presentedNotifications, setPresentedNotifications] = useState<Notifications.Notification[]>([]);
  const [scheduledNotifications, setScheduledNotifications] = useState<Notifications.NotificationRequest[]>([]);

  useEffect(() => {
    loadNotifications();
    loadExpoNotifications();
    
    // Connect to socket and listen for real-time notifications
    socketService.connect().then(() => {
      socketService.onNotification((data: any) => {
        // Add new notification to the list
        const newNotification: LocalNotification = {
          id: data.id || `notif_${Date.now()}`,
          type: data.type,
          user: data.user,
          text: data.message || data.text,
          time: 'now',
          read: false,
          postId: data.postId,
          itemId: data.itemId,
          eventId: data.eventId,
        };
        
        setNotifications(prev => [newNotification, ...prev]);
        setUnreadCount(prev => prev + 1);
      });
    }).catch((error) => {
      console.error('Failed to connect to socket for notifications:', error);
    });

    // Cleanup
    return () => {
      // Socket cleanup is handled by the service
    };
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await notificationsApi.getNotifications(1, 50);
      
      const formattedNotifications: LocalNotification[] = response.notifications.map(notif => ({
        id: notif.id,
        type: notif.type,
        user: notif.user,
        text: notif.message,
        time: formatTimeAgo(notif.createdAt),
        read: notif.isRead,
        postId: notif.postId,
        itemId: notif.itemId,
        eventId: notif.eventId,
      }));
      
      setNotifications(formattedNotifications);
      setUnreadCount(response.unreadCount);
    } catch (error) {
      console.error('Error loading notifications:', error);
      // Fallback to mock notifications
      setNotifications(mockNotifications);
      setUnreadCount(mockNotifications.filter(n => !n.read).length);
    } finally {
      setLoading(false);
    }
  };

  const loadExpoNotifications = async () => {
    try {
      const [presented, scheduled] = await Promise.all([
        NotificationService.getPresentedNotifications(),
        NotificationService.getScheduledNotifications(),
      ]);
      setPresentedNotifications(presented);
      setScheduledNotifications(scheduled);
    } catch (error) {
      console.error('Error loading expo notifications:', error);
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsApi.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.handle} />
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push('/notification-settings' as any)}
              style={styles.settingsButton}
            >
              <Ionicons name="settings-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Notification Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={async () => {
            try {
              await NotificationService.scheduleLocalNotification(
                'Test Notification',
                'This is a test push notification!',
                { type: 'test' }
              );
              alert('Test notification scheduled!');
              loadNotifications();
            } catch (error) {
              console.error('Error scheduling test notification:', error);
              alert('Failed to schedule notification');
            }
          }}
        >
          <Ionicons name="add-circle" size={20} color={theme.colors.primary} />
          <Text style={styles.actionText}>Test Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleMarkAllAsRead}
        >
          <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
          <Text style={styles.actionText}>Mark All Read</Text>
        </TouchableOpacity>
      </View>

      {/* Presented Notifications */}
      {presentedNotifications.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Notifications</Text>
          {presentedNotifications.map((notification, index) => (
            <View key={index} style={styles.notificationCard}>
              <Text style={styles.notificationTitle}>{notification.request.content.title}</Text>
              <Text style={styles.notificationMessage}>{notification.request.content.body}</Text>
              <Text style={styles.notificationTime}>
                {new Date(notification.date).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Scheduled Notifications */}
      {scheduledNotifications.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scheduled Notifications</Text>
          {scheduledNotifications.map((notification, index) => (
            <View key={index} style={styles.notificationCard}>
              <Text style={styles.notificationTitle}>{notification.content.title}</Text>
              <Text style={styles.notificationMessage}>{notification.content.body}</Text>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await NotificationService.cancelScheduledNotification(notification.identifier);
                    loadNotifications();
                  } catch (error) {
                    console.error('Error cancelling notification:', error);
                  }
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Notifications List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : notifications.length > 0 ? (
          <FlatList
            data={notifications}
            renderItem={({ item }) => {
              const colors = getNotificationColor(item.type);
              const icon = getNotificationIcon(item.type);
              
              return (
                <TouchableOpacity
                  style={[
                    styles.notificationCard,
                    !item.read && styles.notificationCardUnread,
                  ]}
                  onPress={() => {
                    handleMarkAsRead(item.id);
                    if (item.postId) {
                      router.push(`/post/${item.postId}` as any);
                    } else if (item.itemId) {
                      router.push(`/product/${item.itemId}` as any);
                    } else if (item.eventId) {
                      router.push(`/event/${item.eventId}` as any);
                    }
                  }}
                >
                  <View style={[styles.iconCircle, { backgroundColor: `${colors[0]}20` }]}>
                    <Ionicons name={icon as any} size={20} color={colors[0]} />
                  </View>
                  <View style={styles.notificationContent}>
                    {item.user && (
                      <View style={styles.notificationHeader}>
                        <Avatar uri={item.user.avatar} size={32} />
                        <View style={styles.notificationText}>
                          <Text style={styles.notificationName}>
                            {item.user.name}
                          </Text>
                          <Text style={styles.notificationMessage}>
                            {item.text}
                          </Text>
                        </View>
                      </View>
                    )}
                    {!item.user && (
                      <Text style={styles.notificationMessage}>{item.text}</Text>
                    )}
                  </View>
                  <View style={styles.notificationMeta}>
                    <Text style={styles.notificationTime}>{item.time}</Text>
                    {!item.read && <View style={styles.unreadDot} />}
                  </View>
                </TouchableOpacity>
              );
            }}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: theme.spacing[2] }} />}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <EmptyState
            icon="notifications-outline"
            title="No notifications yet"
          />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  settingsButton: {
    padding: theme.spacing[1],
  },
  headerTitle: {
    fontSize: theme.typography.fontSize[18],
    fontWeight: theme.typography.fontWeight.bold,
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  listContent: {
    padding: theme.spacing[4],
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: theme.spacing[3],
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: theme.spacing[3],
  },
  notificationCardUnread: {
    backgroundColor: '#F9FAFB',
    borderColor: theme.colors.primary,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing[2],
  },
  notificationText: {
    flex: 1,
  },
  notificationName: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#111827',
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: theme.typography.fontSize[14],
    color: '#6B7280',
    lineHeight: 20,
  },
  notificationMeta: {
    alignItems: 'flex-end',
    gap: theme.spacing[1],
  },
  notificationTime: {
    fontSize: theme.typography.fontSize[10],
    color: '#9CA3AF',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
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
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    gap: theme.spacing[3],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing[2],
  },
  actionText: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary,
  },
  section: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize[16],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#111827',
    marginBottom: theme.spacing[2],
  },
  notificationTitle: {
    fontSize: theme.typography.fontSize[14],
    fontWeight: theme.typography.fontWeight.semibold,
    color: '#111827',
    marginBottom: 2,
  },
  cancelText: {
    fontSize: theme.typography.fontSize[12],
    color: '#EF4444',
    fontWeight: theme.typography.fontWeight.medium,
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

