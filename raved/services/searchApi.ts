import api from './api';

export interface SearchResult {
  users?: Array<{
    id: string;
    name: string;
    username: string;
    avatar: string;
    faculty?: string;
    bio?: string;
  }>;
  posts?: Array<{
    id: string;
    caption: string;
    media: {
      url?: string;
      thumbnail?: string;
      items?: string[];
      type: string;
    };
    user: {
      id: string;
      name: string;
      avatar: string;
    };
    tags?: string[];
  }>;
  tags?: string[];
  items?: Array<{
    id: string;
    name: string;
    price: number;
    images: string[];
    category: string;
    seller: {
      id: string;
      name: string;
      avatar: string;
    };
  }>;
  events?: Array<{
    id: string;
    title: string;
    description: string;
    date: string;
    location: string;
    category: string;
  }>;
}

export interface SearchResponse {
  success: boolean;
  results: SearchResult;
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export const searchApi = {
  /**
   * Advanced search with filters
   * @param query - Search query string
   * @param type - Type of search: 'all', 'users', 'posts', 'tags', 'items', 'events'
   * @param filters - Additional filters
   */
  advancedSearch: async (
    query: string,
    type: 'all' | 'users' | 'posts' | 'tags' | 'items' | 'events' = 'all',
    filters?: {
      category?: string;
      faculty?: string;
      minPrice?: number;
      maxPrice?: number;
      condition?: string;
    },
    sortBy: string = 'relevance',
    page: number = 1,
    limit: number = 20
  ): Promise<SearchResponse> => {
    const params: any = {
      q: query,
      type,
      sortBy,
      page,
      limit,
    };

    if (filters) {
      if (filters.category) params.category = filters.category;
      if (filters.faculty) params.faculty = filters.faculty;
      if (filters.minPrice !== undefined) params.minPrice = filters.minPrice;
      if (filters.maxPrice !== undefined) params.maxPrice = filters.maxPrice;
      if (filters.condition) params.condition = filters.condition;
    }

    const response = await api.get('/search/advanced', { params });
    return response.data;
  },
};

export default searchApi;

