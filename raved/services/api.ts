import axios from 'axios';
import { Storage } from './storage';

// For React Native development:
// - iOS Simulator: use 'http://localhost:3000'
// - Android Emulator: use 'http://10.0.2.2:3000'
// - Physical Device: use your computer's IP address (e.g., 'http://192.168.1.100:3000')
// You can set EXPO_PUBLIC_API_URL environment variable to override this
const API_BASE_URL = __DEV__
  ? (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000') + '/api/v1'
  : 'https://api.raved.com/api/v1'; // Production URL with API version

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await Storage.get<string>('authToken', '');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await Storage.get<string>('refreshToken', '');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { token } = response.data;
          await Storage.set('authToken', token);

          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        await Storage.remove('authToken');
        await Storage.remove('refreshToken');
        await Storage.set('loggedIn', false);
        // You might want to navigate to login screen here
      }
    }

    return Promise.reject(error);
  }
);

export default api;

/**
 * Normalize a user-provided identifier and perform login.
 * Rules:
 * - If identifier looks like an email (contains '@' and a domain), send as-is.
 * - If identifier looks like a phone number (digits only or starts with '+'), send as-is.
 * - If identifier starts with '@', treat as username and send as-is.
 * - Otherwise, assume it's a username and prefix with '@'.
 */
export async function login(identifier: string, password: string) {
   let normalized = identifier?.toString().trim();
   if (!normalized) throw new Error('Identifier is required');

   // Only allow email login for now
   const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized);
   if (!isEmail) {
     throw new Error('Only email login is currently supported. Please use your email address.');
   }

   console.log('API login request:', { email: normalized, hasPassword: !!password });
   const res = await api.post('/auth/login', {
     identifier: normalized,
     password,
   });
   console.log('API login response status:', res.status);

   return res.data;
}