import api from './api';

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'message' | 'sale' | 'event';
  title: string;
  message: string;
  user?: {
    id: string;
    name: string;
    avatar: string;
  };
  postId?: string;
  itemId?: string;
  eventId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  data?: Record<string, any>;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  mentions: boolean;
  messages: boolean;
  events: boolean;
  sales: boolean;
  marketing: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export const notificationsApi = {
  /**
   * Get user's notifications
   */
  getNotifications: async (page: number = 1, limit: number = 20): Promise<NotificationsResponse> => {
    const response = await api.get('/notifications', {
      params: { page, limit },
    });
    return response.data;
  },

  /**
   * Mark notification as read
   */
  markAsRead: async (notificationId: string): Promise<{ success: boolean }> => {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data;
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async (): Promise<{ success: boolean }> => {
    const response = await api.put('/notifications/read-all');
    return response.data;
  },

  /**
   * Get notification preferences
   */
  getPreferences: async (): Promise<{ success: boolean; preferences: NotificationPreferences }> => {
    const response = await api.get('/notifications/preferences');
    return response.data;
  },

  /**
   * Update notification preferences
   */
  updatePreferences: async (
    preferences: Partial<NotificationPreferences>
  ): Promise<{ success: boolean; preferences: NotificationPreferences }> => {
    const response = await api.put('/notifications/preferences', preferences);
    return response.data;
  },
};

export default notificationsApi;

