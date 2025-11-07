// src/app/data/profile.ts

export interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  avatar?: string; // later we can point to /public/...
  memberSince: string;
  status: 'active' | 'pending' | 'banned';
  preferences: {
    notifications: boolean;
    nearbyDeals: boolean;
    smsUpdates: boolean;
  };
}

export const currentUser: UserProfile = {
  name: 'Kashif Yusuf',
  email: 'kashif@example.com',
  phone: '+1 (331) 123-4567',
  avatar: '', // leave empty for now
  memberSince: 'Oct 2025',
  status: 'active',
  preferences: {
    notifications: true,
    nearbyDeals: true,
    smsUpdates: false,
  },
};