import api from './api';

export interface CreatePostData {
  type: 'image' | 'video' | 'carousel' | 'text';
  caption?: string;
  media?: any[];
  location?: string;
  tags?: string[];
  brand?: string;
  occasion?: string;
  visibility?: 'public' | 'connections' | 'faculty';
  isForSale?: boolean;
  saleDetails?: {
    itemName: string;
    price: number;
    originalPrice?: number;
    category: string;
    condition: string;
    size?: string;
    brand?: string;
    color?: string;
    material?: string;
    paymentMethods?: string[];
    meetupLocation?: string;
    sellerPhone?: string;
    negotiable?: boolean;
  };
}

export interface CommentData {
  text: string;
  parentCommentId?: string;
}

export const postsApi = {
  // Feed operations
  getFeed: async (page = 1, limit = 20) => {
    const response = await api.get(`/posts/feed?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Get posts by faculty
  getFacultyPosts: async (facultyId: string, page = 1, limit = 20) => {
    const response = await api.get(`/posts/faculty/${facultyId}?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Post operations
  getPost: async (postId: string) => {
    const response = await api.get(`/posts/${postId}`);
    return response.data;
  },

  createPost: async (postData: CreatePostData) => {
    const response = await api.post('/posts', postData);
    return response.data;
  },

  // Like operations
  likePost: async (postId: string) => {
    const response = await api.post(`/posts/${postId}/like`);
    return response.data;
  },

  // Comment operations
  commentOnPost: async (postId: string, commentData: CommentData) => {
    const response = await api.post(`/posts/${postId}/comments`, commentData);
    return response.data;
  },

  getPostComments: async (postId: string, page = 1, limit = 20) => {
    const response = await api.get(`/posts/${postId}/comments?page=${page}&limit=${limit}`);
    return response.data;
  },

  // Additional operations for full backend compatibility
  updatePost: async (postId: string, updateData: Partial<CreatePostData>) => {
    const response = await api.put(`/posts/${postId}`, updateData);
    return response.data;
  },

  deletePost: async (postId: string) => {
    const response = await api.delete(`/posts/${postId}`);
    return response.data;
  },

  // Share operations
  sharePost: async (postId: string) => {
    const response = await api.post(`/posts/${postId}/share`);
    return response.data;
  },

  // Report operations
  reportPost: async (postId: string, reason: string) => {
    const response = await api.post(`/posts/${postId}/report`, { reason });
    return response.data;
  },

  // Get post suggestions
  getPostSuggestions: async (limit = 10) => {
    const response = await api.get(`/posts/suggestions?limit=${limit}`);
    return response.data;
  },

  // Get trending posts
  getTrendingPosts: async (page = 1, limit = 20, timeWindow: '24h' | '7d' | '30d' = '24h') => {
    const response = await api.get(`/posts/trending?page=${page}&limit=${limit}&timeWindow=${timeWindow}`);
    return response.data;
  },
};

export default postsApi;