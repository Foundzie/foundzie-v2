// src/app/data/users.ts

// What statuses we allow everywhere
export type AdminUserStatus = "active" | "invited" | "disabled" | "collected";

// What roles we allow
export type AdminUserRole = "admin" | "editor" | "viewer";

// Concierge workflow status
export type ConciergeStatus = "open" | "in-progress" | "done";

// The shape every user will have
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  joined: string;

  // NEW: mobile + targeting fields (same idea as before)
  interest?: string;
  source?: string;
  tags: string[];

  // NEW: phone (can be null if we don't know it yet)
  phone?: string | null;

  // NEW: concierge workflow
  conciergeStatus?: ConciergeStatus;
  conciergeNote?: string;

  // NEW: one-to-one chat room id
  roomId: string;
}

// Your starter users
export const mockUsers: AdminUser[] = [
  {
    id: "1",
    name: "Kashif Yusuf",
    email: "kashif@example.com",
    role: "admin",
    status: "active",
    joined: "Oct 2025",
    interest: "Nightlife in Chicago",
    source: "mobile-concierge",
    tags: ["vip", "chicago", "high-spend", "concierge-request"],
    conciergeStatus: "open",
    conciergeNote: "",
    roomId: "user-1",
    phone: null,
  },
  {
    id: "2",
    name: "Amina Patel",
    email: "amina@example.com",
    role: "editor",
    status: "active",
    joined: "Sep 2025",
    interest: "Family activities in suburbs",
    source: "mobile-concierge",
    tags: ["family", "suburbs"],
    conciergeStatus: "open",
    conciergeNote: "",
    roomId: "user-2",
    phone: null,
  },
  {
    id: "3",
    name: "Diego Martinez",
    email: "diego@example.com",
    role: "viewer",
    status: "invited",
    joined: "Sep 2025",
    interest: "",
    source: "web",
    tags: [],
    conciergeStatus: "open",
    conciergeNote: "",
    roomId: "user-3",
    phone: null,
  },
  {
    id: "4",
    name: "Sarah Lee",
    email: "sarah@example.com",
    role: "viewer",
    status: "active",
    joined: "Aug 2025",
    interest: "",
    source: "web",
    tags: [],
    conciergeStatus: "open",
    conciergeNote: "",
    roomId: "user-4",
    phone: null,
  },
];

// Export both ways
export default mockUsers;
