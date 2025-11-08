// src/app/data/users.ts

export type AdminUserStatus = "active" | "invited" | "disabled";
export type AdminUserRole = "admin" | "editor" | "viewer";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  joined: string; // month year just for display
}

const mockUsers: AdminUser[] = [
  {
    id: "1",
    name: "Kashif Yusuf",
    email: "kashif@example.com",
    role: "admin",
    status: "active",
    joined: "Oct 2025",
  },
  {
    id: "2",
    name: "Amina Patel",
    email: "amina@example.com",
    role: "editor",
    status: "active",
    joined: "Sep 2025",
  },
  {
    id: "3",
    name: "Diego Martínez",
    email: "diego@example.com",
    role: "viewer",
    status: "invited",
    joined: "Sep 2025",
  },
  {
    id: "4",
    name: "Sarah Lee",
    email: "sarah@example.com",
    role: "viewer",
    status: "active",
    joined: "Aug 2025",
  },
];

export default mockUsers;