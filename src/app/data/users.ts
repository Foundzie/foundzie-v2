// src/app/data/users.ts

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  status: "active" | "invited" | "suspended";
  joined: string; // e.g. "Oct 2025"
  role: "admin" | "editor" | "viewer";
}

export const mockUsers: AdminUser[] = [
  {
    id: "1",
    name: "Kashif Yusuf",
    email: "kashif@example.com",
    status: "active",
    joined: "Oct 2025",
    role: "admin",
  },
  {
    id: "2",
    name: "Amina Patel",
    email: "amina@example.com",
    status: "active",
    joined: "Sep 2025",
    role: "editor",
  },
  {
    id: "3",
    name: "Diego Martinez",
    email: "diego@example.com",
    status: "invited",
    joined: "Sep 2025",
    role: "viewer",
  },
  {
    id: "4",
    name: "Sarah Lee",
    email: "sarah@example.com",
    status: "active",
    joined: "Aug 2025",
    role: "viewer",
  },
];