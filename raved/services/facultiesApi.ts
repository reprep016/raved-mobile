import api from './api';

export interface Faculty {
  id: string;
  name: string;
  memberCount: number;
  postCount: number;
  eventCount: number;
}

export interface FacultyStats {
  memberCount: number;
  postCount: number;
  eventCount: number;
}

export const facultiesApi = {
  // Get all faculties
  getFaculties: async (): Promise<Faculty[]> => {
    const response = await api.get('/faculties');
    return response.data.faculties;
  },

  // Get faculty stats
  getFacultyStats: async (facultyId: string): Promise<FacultyStats> => {
    const response = await api.get(`/faculties/${facultyId}/stats`);
    return response.data.stats;
  }
};

export default facultiesApi;

