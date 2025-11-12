// src/app/api/users/store.ts
import type { AdminUser as BaseAdminUser } from "@/app/data/users";
import {
  userProvider,
  type AdminUserInput,
} from "./provider";

// Our API returns the base user + optional tags (non-breaking)
export type AdminUser = BaseAdminUser & { tags?: string[] };

export async function listUsers(): Promise<AdminUser[]> {
  return userProvider.list();
}

export async function getUser(id: string): Promise<AdminUser | undefined> {
  return userProvider.get(id);
}

export async function createUser(partial: AdminUserInput): Promise<AdminUser> {
  return userProvider.create(partial);
}

export async function updateUser(
  id: string,
  partial: AdminUserInput
): Promise<AdminUser | undefined> {
  return userProvider.update(id, partial);
}

export async function deleteUser(id: string): Promise<boolean> {
  return userProvider.delete(id);
}

// used later for mass activate/disable
export async function bulkUpdateUsers(
  ids: string[],
  partial: AdminUserInput
): Promise<number> {
  return userProvider.bulkUpdate(ids, partial);
}
