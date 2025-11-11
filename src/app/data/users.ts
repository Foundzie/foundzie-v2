// src/app/data/users.ts

// what statuses we allow everywhere
export type AdminUserStatus = "active" | "invited" | "disabled" | "collected";

// what roles we allow
export type AdminUserRole = "admin" | "editor" | "viewer";

// the shape every user will have
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  joined: string; // display only

  // NEW optional fields (these are what mobile /collect can send)
  interest?: string;
  source?: string;
}

// your starter users
export const mockUsers: AdminUser[] = [
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

// export both ways
export default mockUsers;