import api from './api';

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  category: 'academic' | 'social' | 'sports' | 'cultural' | 'networking' | 'other';
  audience: 'all' | 'faculty' | 'graduate' | 'undergraduate';
  organizer: {
    id: string;
    name: string;
    avatar: string;
    faculty?: string;
  };
  image?: string;
  attendees: number;
  maxAttendees?: number;
  attending: boolean;
  tags?: string[];
  createdAt: string;
}

export interface CreateEventData {
  title: string;
  description?: string;
  date: string;
  time: string;
  location: string;
  category: 'academic' | 'social' | 'sports' | 'cultural' | 'networking' | 'other';
  audience: 'all' | 'faculty' | 'graduate' | 'undergraduate';
  maxAttendees?: number;
  image?: string;
  tags?: string[];
}

export const eventsApi = {
  // Get events feed
  getEvents: async (filters?: {
    category?: string;
    audience?: string;
    faculty?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const params: any = {};
    if (filters?.category) params.category = filters.category;
    if (filters?.audience) params.audience = filters.audience;
    if (filters?.faculty) params.faculty = filters.faculty;
    if (filters?.page) params.page = filters.page;
    if (filters?.limit) params.limit = filters.limit;
    
    const response = await api.get('/events', { params });
    return response.data;
  },

  // Get single event
  getEvent: async (eventId: string) => {
    const response = await api.get(`/events/${eventId}`);
    return response.data;
  },

  // Create event
  createEvent: async (eventData: CreateEventData) => {
    const response = await api.post('/events', eventData);
    return response.data;
  },

  // Update event
  updateEvent: async (eventId: string, eventData: Partial<CreateEventData>) => {
    const response = await api.patch(`/events/${eventId}`, eventData);
    return response.data;
  },

  // Delete event
  deleteEvent: async (eventId: string) => {
    const response = await api.delete(`/events/${eventId}`);
    return response.data;
  },

  // Toggle attendance
  toggleAttendance: async (eventId: string) => {
    const response = await api.post(`/events/${eventId}/attend`);
    return response.data;
  },

  // Get event attendees
  getEventAttendees: async (eventId: string, page = 1, limit = 20) => {
    const response = await api.get(`/events/${eventId}/attendees`, {
      params: { page, limit }
    });
    return response.data;
  },
};

export default eventsApi;

