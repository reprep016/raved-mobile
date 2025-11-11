import api from './api';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration: string;
  features: string[];
}

export interface SubscriptionStatus {
  status: 'free' | 'trial' | 'premium';
  isPremium: boolean;
  isTrial: boolean;
  trialDaysLeft: number | null;
  subscription: {
    id: string;
    planType: string;
    amount: number;
    status: string;
    startsAt: string;
    expiresAt: string;
  } | null;
}

export const subscriptionsApi = {
  // Get subscription plans
  getPlans: async (): Promise<SubscriptionPlan[]> => {
    const response = await api.get('/subscriptions/plans');
    return response.data.plans;
  },

  // Get user subscription status
  getSubscriptionStatus: async (): Promise<SubscriptionStatus> => {
    const response = await api.get('/subscriptions/status');
    return response.data;
  }
};

export default subscriptionsApi;

