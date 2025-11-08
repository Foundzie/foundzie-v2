// src/app/data/users.ts

export type UserStatus = 'active' | 'invited' | 'disabled';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status: UserStatus;
  joined: string; // e.g. "Oct 2025"
}

export const mockUsers: AppUser[] = [
  {
    id: '1',
    name: 'Kashif Yusuf',
    email: 'kashif@example.com',
    role: 'admin',
    status: 'active',
    joined: 'Oct 2025',
  },
  {
    id: '2',
    name: 'Amina Patel',
    email: 'amina@example.com',
    role: 'editor',
    status: 'active',
    joined: 'Sep 2025',
  },
  {
    id: '3',
    name: 'Diego Martínez',
    email: 'diego@example.com',
    role: 'viewer',
    status: 'invited',
    joined: 'Sep 2025',
  },
  {
    id: '4',
    name: 'Sarah Lee',
    email: 'sarah@example.com',
    role: 'viewer',
    status: 'active',
    joined: 'Aug 2025',
  },
];

// so you can do both `import { mockUsers } ...` and `import users ...`
export default mockUsers;