// src/app/api/admin/maintenance/store.ts
import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";

export type MaintenanceState = {
  enabled: boolean;
  message: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

const KEY = "foundzie:maintenance:v1";

const DEFAULT_MESSAGE =
  "Foundzie is in maintenance right now. Some features may be limited.";

function defaultState(): MaintenanceState {
  return {
    enabled: false,
    message: DEFAULT_MESSAGE,
    updatedAt: null,
    updatedBy: null,
  };
}

async function load(): Promise<MaintenanceState> {
  const fromKv = (await kvGetJSON<MaintenanceState>(KEY)) ?? null;
  if (!fromKv) return defaultState();

  return {
    ...defaultState(),
    ...fromKv,
  };
}

async function save(state: MaintenanceState): Promise<void> {
  await kvSetJSON(KEY, state);
}

/* ------------------------------------------------------------------ */
/*  Public helpers                                                     */
/* ------------------------------------------------------------------ */

export async function getMaintenanceState(): Promise<MaintenanceState> {
  return load();
}

export async function setMaintenanceState(input: {
  enabled?: boolean;
  message?: string | null;
  updatedBy?: string | null;
}): Promise<MaintenanceState> {
  const current = await load();
  const now = new Date().toISOString();

  const next: MaintenanceState = {
    ...current,
    enabled:
      typeof input.enabled === "boolean" ? input.enabled : current.enabled,
    message:
      input.message !== undefined && input.message !== null
        ? String(input.message)
        : current.message,
    updatedAt: now,
    updatedBy:
      input.updatedBy !== undefined ? input.updatedBy : current.updatedBy,
  };

  await save(next);
  return next;
}
