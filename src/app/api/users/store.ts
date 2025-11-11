// src/app/api/users/store.ts
import type { AdminUser } from "@/app/data/users";
import {
  userProvider,
  type AdminUserInput,
} from "./provider";

// the public functions your route handlers already use

export async function listUsers(): Promise<AdminUser[]> {
  return userProvider.list();
}

export async function getUser(id: string): Promise<AdminUser | undefined> {
  return userProvider.get(id);
}

export async function createUser(
  partial: AdminUserInput
): Promise<AdminUser> {
  return userProvider.create(partial);
}

export async function updateUser(
  id: string,
  partial: AdminUserInput
): Promise<AdminUser | undefined> {
  return userProvider.update(id, partial);
}
