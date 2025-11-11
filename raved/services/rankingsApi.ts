import api from './api';

export interface RankingUser {
  rank: number;
  userId: string;
  username: string;
  name: string;
  avatar: string;
  score: number;
  stats: {
    likes: number;
    comments: number;
    shares: number;
    sales: number;
    features: number;
  };
}

export interface RankingsResponse {
  period: 'weekly' | 'monthly' | 'all-time';
  prizePool: {
    weekly: number;
    monthly: number;
    allTime: number;
  };
  rankings: RankingUser[];
  userRank: number | null;
  userRanking: RankingUser | null;
  scoringSystem: {
    postLike: number;
    postComment: number;
    postShare: number;
    itemSale: number;
    weeklyFeature: number;
  };
}

export const rankingsApi = {
  // Get rankings by period
  getRankings: async (period: 'weekly' | 'monthly' | 'all-time' = 'weekly'): Promise<RankingsResponse> => {
    const response = await api.get('/rankings', {
      params: { period }
    });
    return response.data;
  }
};

export default rankingsApi;

