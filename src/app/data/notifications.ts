// src/app/data/notifications.ts

export type NotificationType = 'system' | 'event' | 'offer' | 'chat';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;        // e.g. "2h ago"
  unread?: boolean;
  actionLabel?: string;
  actionHref?: string;
}

export const mockNotifications: AppNotification[] = [
  {
    id: '1',
    type: 'system',
    title: 'Welcome to Foundzie 👋',
    message: 'Tap around the Explore and Nearby tabs to see places near you.',
    time: '2h ago',
    unread: true,
  },
  {
    id: '2',
    type: 'offer',
    title: '15% off at GMEA',
    message: 'You’re close to GMEA in Downers Grove. Want to book?',
    time: '3h ago',
    unread: true,
    actionLabel: 'View',
    actionHref: '/mobile/explore',
  },
  {
    id: '3',
    type: 'event',
    title: 'Tonight in your area',
    message: 'Live music and family-friendly events nearby.',
    time: 'yesterday',
  },
];