import api from './api';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  faculty: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  website?: string;
  isVerified: boolean;
  isPremium: boolean;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  faculty?: string;
}

export interface ConnectionData {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  faculty: string;
  isMutual: boolean;
  connectedAt: string;
}

export const userApi = {
  // Profile operations
  getProfile: async (userId?: string) => {
    const endpoint = userId ? `/users/${userId}` : '/users/profile';
    const response = await api.get(endpoint);
    return response.data;
  },

  updateProfile: async (profileData: UpdateProfileData) => {
    const response = await api.put('/users/profile', profileData);
    return response.data;
  },

  // Avatar operations
  updateAvatar: async (avatarUrl: string) => {
    const response = await api.put('/users/avatar', { avatarUrl });
    return response.data;
  },

  // Connections/Followers
  getConnections: async (userId?: string, type: 'followers' | 'following' = 'following', page = 1, limit = 20) => {
    const endpoint = userId ? `/users/${userId}/connections` : '/users/connections';
    const response = await api.get(endpoint, { params: { type, page, limit } });
    return response.data;
  },

  followUser: async (userId: string) => {
    const response = await api.post(`/users/${userId}/follow`);
    return response.data;
  },

  unfollowUser: async (userId: string) => {
    const response = await api.delete(`/users/${userId}/follow`);
    return response.data;
  },

  // Search users
  searchUsers: async (query: string, page = 1, limit = 20) => {
    const response = await api.get('/users/search', { params: { q: query, page, limit } });
    return response.data;
  },

  // User stats
  getUserStats: async (userId?: string) => {
    const endpoint = userId ? `/users/${userId}/stats` : '/users/stats';
    const response = await api.get(endpoint);
    return response.data;
  },

  // Privacy settings
  updatePrivacySettings: async (settings: {
    profileVisibility?: 'public' | 'connections' | 'private';
    showOnlineStatus?: boolean;
    allowMessages?: 'everyone' | 'connections' | 'none';
  }) => {
    const response = await api.put('/users/privacy', settings);
    return response.data;
  },

  // Notification settings
  updateNotificationSettings: async (settings: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    smsNotifications?: boolean;
    postLikes?: boolean;
    comments?: boolean;
    follows?: boolean;
    messages?: boolean;
  }) => {
    const response = await api.put('/users/notifications', settings);
    return response.data;
  },

  // Device tokens for push notifications
  registerDeviceToken: async (token: string, platform: 'ios' | 'android' | 'web') => {
    const response = await api.post('/device-tokens', { token, platform });
    return response.data;
  },

  unregisterDeviceToken: async (token: string) => {
    const response = await api.delete('/device-tokens', { data: { token } });
    return response.data;
  },

  // Account operations
  deleteAccount: async () => {
    const response = await api.delete('/users/account');
    return response.data;
  },

  // Rankings/leaderboard
  getRankings: async (type: 'weekly' | 'monthly' | 'all-time' = 'weekly', faculty?: string) => {
    const response = await api.get('/users/rankings', { params: { type, faculty } });
    return response.data;
  },

  // Get user posts
  getUserPosts: async (userId: string, page = 1, limit = 20) => {
    const response = await api.get(`/users/${userId}/posts`, { params: { page, limit } });
    return response.data;
  },

  // Get user comments
  getUserComments: async (userId: string, page = 1, limit = 20) => {
    const response = await api.get(`/users/${userId}/comments`, { params: { page, limit } });
    return response.data;
  },

  // Get user liked posts
  getUserLikedPosts: async (userId: string, page = 1, limit = 20) => {
    const response = await api.get(`/users/${userId}/liked-posts`, { params: { page, limit } });
    return response.data;
  },

  // Get user saved posts
  getUserSavedPosts: async (userId: string, page = 1, limit = 20) => {
    const response = await api.get(`/users/${userId}/saved-posts`, { params: { page, limit } });
    return response.data;
  },
};

export default userApi;