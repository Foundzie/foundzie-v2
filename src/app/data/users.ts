// src/app/data/users.ts

export type UserStatus = 'active' | 'invited' | 'disabled';
export type UserRole = 'admin' | 'editor' | 'viewer';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  joined: string; // nice-to-have text like "Joined Oct 2025"
}

const mockUsers: AdminUser[] = [
  {
    id: '1',
    name: 'Kashif Yusuf',
    email: 'kashif@example.com',
    role: 'admin',
    status: 'active',
    joined: 'Joined Oct 2025',
  },
  {
    id: '2',
    name: 'Amina Patel',
    email: 'amina@example.com',
    role: 'editor',
    status: 'active',
    joined: 'Joined Sep 2025',
  },
  {
    id: '3',
    name: 'Diego Martínez',
    email: 'diego@example.com',
    role: 'viewer',
    status: 'invited',
    joined: 'Invited 2 days ago',
  },
  {
    id: '4',
    name: 'Sarah Lee',
    email: 'sarah@example.com',
    role: 'viewer',
    status: 'active',
    joined: 'Joined Aug 2025',
  },
];

export default mockUsers;