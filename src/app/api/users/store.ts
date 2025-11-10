// src/app/api/users/store.ts
import mockUsers, { type AdminUser } from "@/app/data/users";

// single in-memory array that all user routes will share
let users: AdminUser[] = [...mockUsers];

export function listUsers(): AdminUser[] {
  return users;
}

export function createUser(partial: Partial<AdminUser>): AdminUser {
  const user: AdminUser = {
    id: (users.length + 1).toString(),
    name: partial.name ?? "Anonymous visitor",
    email: partial.email ?? "no-email@example.com",
    role: partial.role ?? "viewer",
    status: partial.status ?? "active",
    joined: new Date().toLocaleString("en-US", {
      month: "short",
      year: "numeric",
    }),
  };

  // newest on top
  users.unshift(user);
  return user;
}