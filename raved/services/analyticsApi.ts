import api from './api';

export interface UserAnalytics {
  period: string;
  posts: {
    total: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalViews: number;
    avgLikesPerPost: number;
    avgCommentsPerPost: number;
    engagementRate: number;
  };
  followers: {
    growth: Array<{ date: string; count: number }>;
  };
  bestPosts: Array<{
    id: string;
    caption: string;
    likes: number;
    comments: number;
    shares: number;
    views: number;
    createdAt: string;
  }>;
  audience: {
    demographics: Array<{ faculty: string; count: number }>;
  };
}

export interface StoreAnalytics {
  period: string;
  items: {
    total: number;
    totalViews: number;
    totalLikes: number;
    totalSaves: number;
    avgViewsPerItem: number;
    avgLikesPerItem: number;
  };
  sales: {
    total: number;
    totalRevenue: number;
  };
  topItems: Array<{
    id: string;
    name: string;
    price: number;
    sales: number;
    views: number;
    likes: number;
    createdAt: string;
  }>;
  salesOverTime: Array<{
    date: string;
    itemsSold: number;
    revenue: number;
  }>;
}

export const analyticsApi = {
  // Get user analytics
  getUserAnalytics: async (period: '7d' | '30d' | '90d' = '30d'): Promise<{ success: boolean; analytics: UserAnalytics }> => {
    const response = await api.get(`/analytics/user?period=${period}`);
    return response.data;
  },

  // Get store analytics (premium only)
  getStoreAnalytics: async (period: '7d' | '30d' | '90d' = '30d'): Promise<{ success: boolean; analytics: StoreAnalytics }> => {
    const response = await api.get(`/analytics/store?period=${period}`);
    return response.data;
  },

  // Track analytics event
  trackEvent: async (data: {
    eventType?: string;
    eventCategory?: string;
    eventAction?: string;
    eventLabel?: string;
    eventValue?: number;
    metadata?: any;
  }): Promise<{ success: boolean }> => {
    const response = await api.post('/analytics/track', data);
    return response.data;
  },
};

