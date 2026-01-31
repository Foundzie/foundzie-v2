import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";
import { addNotification, type NotificationItem } from "@/app/api/notifications/store";
import { recordSponsoredPush } from "@/app/api/health/store";

export type CampaignStatus = "draft" | "active" | "paused" | "ended";
export type CampaignChannel = "push" | "call" | "hybrid";

export type CampaignTargeting = {
  // v1: simple targeting (expand later)
  roomIds?: string[];       // explicit rooms
  tags?: string[];          // match user.tags (future)
  city?: string;            // match city tag like city:Westmont (future)
  radiusKm?: number;        // future
};

export type CampaignCreative = {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  mediaUrl?: string;
  mediaKind?: "image" | "gif" | "other" | null;
};

export type CampaignSchedule = {
  startAt?: string | null;  // ISO
  endAt?: string | null;    // ISO
};

export interface SponsoredCampaign {
  id: string;
  createdAt: string;
  updatedAt: string;

  name: string;
  advertiserName: string;

  status: CampaignStatus;
  channels: CampaignChannel[];

  schedule: CampaignSchedule;
  targeting: CampaignTargeting;

  creative: CampaignCreative;

  budgetTier?: "basic" | "standard" | "premium" | string;
}

type UpsertResult = { created: boolean; updated: boolean; item: SponsoredCampaign };

const CAMPAIGNS_KEY = "foundzie:campaigns:v1";

// one-per-campaign delivery log (prevents spam)
type DeliveryLog = {
  campaignId: string;
  lastPushAt: string | null;
  pushCount: number;
};
function deliveryKey(id: string) {
  return `foundzie:campaign:delivery:${id}:v1`;
}

function nowIso() {
  return new Date().toISOString();
}

function safeStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function safeChannels(v: any): CampaignChannel[] {
  const raw = safeStringArray(v);
  const out: CampaignChannel[] = [];
  for (const s of raw) {
    if (s === "push" || s === "call" || s === "hybrid") out.push(s);
  }
  return out.length ? out : ["push"];
}

function inWindow(schedule?: CampaignSchedule | null) {
  const now = Date.now();
  const start = schedule?.startAt ? Date.parse(schedule.startAt) : NaN;
  const end = schedule?.endAt ? Date.parse(schedule.endAt) : NaN;

  if (Number.isFinite(start) && now < start) return false;
  if (Number.isFinite(end) && now > end) return false;
  return true;
}

async function loadAll(): Promise<SponsoredCampaign[]> {
  const items = (await kvGetJSON<SponsoredCampaign[]>(CAMPAIGNS_KEY)) ?? [];
  return Array.isArray(items) ? items.slice() : [];
}

async function saveAll(items: SponsoredCampaign[]): Promise<void> {
  await kvSetJSON(CAMPAIGNS_KEY, items);
}

export async function listCampaigns(): Promise<SponsoredCampaign[]> {
  const items = await loadAll();
  // newest first
  return items.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getCampaign(id: string): Promise<SponsoredCampaign | null> {
  const items = await loadAll();
  return items.find((c) => c.id === id) ?? null;
}

function normalizeCampaignFromPayload(data: any, existing?: SponsoredCampaign): SponsoredCampaign {
  const base: SponsoredCampaign =
    existing ??
    ({
      id: crypto.randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      name: "",
      advertiserName: "",
      status: "draft",
      channels: ["push"],
      schedule: { startAt: null, endAt: null },
      targeting: {},
      creative: { title: "", message: "" },
      budgetTier: "basic",
    } as SponsoredCampaign);

  const schedule: CampaignSchedule = {
    startAt:
      data?.schedule?.startAt !== undefined ? (data.schedule.startAt || null) : base.schedule?.startAt ?? null,
    endAt:
      data?.schedule?.endAt !== undefined ? (data.schedule.endAt || null) : base.schedule?.endAt ?? null,
  };

  const targeting: CampaignTargeting = {
    roomIds:
      data?.targeting?.roomIds !== undefined ? safeStringArray(data.targeting.roomIds) : base.targeting?.roomIds,
    tags: data?.targeting?.tags !== undefined ? safeStringArray(data.targeting.tags) : base.targeting?.tags,
    city: data?.targeting?.city !== undefined ? String(data.targeting.city || "").trim() : base.targeting?.city,
    radiusKm:
      data?.targeting?.radiusKm !== undefined
        ? Number(data.targeting.radiusKm || 0) || undefined
        : base.targeting?.radiusKm,
  };

  const creative: CampaignCreative = {
    title: String(data?.creative?.title ?? data?.title ?? base.creative.title ?? "").trim(),
    message: String(data?.creative?.message ?? data?.message ?? base.creative.message ?? "").trim(),
    actionLabel: String(data?.creative?.actionLabel ?? data?.actionLabel ?? base.creative.actionLabel ?? "").trim() || undefined,
    actionHref: String(data?.creative?.actionHref ?? data?.actionHref ?? base.creative.actionHref ?? "").trim() || undefined,
    mediaUrl: String(data?.creative?.mediaUrl ?? data?.mediaUrl ?? base.creative.mediaUrl ?? "").trim() || undefined,
    mediaKind:
      (data?.creative?.mediaKind ?? data?.mediaKind ?? base.creative.mediaKind ?? null) as any,
  };

  const status = (String(data?.status ?? base.status) as CampaignStatus) || "draft";
  const channels = safeChannels(data?.channels ?? base.channels);

  return {
    ...base,
    updatedAt: nowIso(),
    name: String(data?.name ?? base.name).trim(),
    advertiserName: String(data?.advertiserName ?? base.advertiserName).trim(),
    status: status === "draft" || status === "active" || status === "paused" || status === "ended" ? status : "draft",
    channels,
    schedule,
    targeting,
    creative,
    budgetTier: String(data?.budgetTier ?? base.budgetTier ?? "basic").trim(),
  };
}

export async function upsertCampaignFromPayload(data: any): Promise<UpsertResult> {
  const all = await loadAll();

  let created = false;
  let updated = false;

  if (data?.id) {
    const idx = all.findIndex((c) => c.id === data.id);
    if (idx !== -1) {
      const next = normalizeCampaignFromPayload(data, all[idx]);
      all[idx] = next;
      await saveAll(all);
      return { created: false, updated: true, item: next };
    }
  }

  const next = normalizeCampaignFromPayload(data, undefined);
  created = true;
  all.unshift(next);
  await saveAll(all);
  return { created, updated, item: next };
}

/**
 * Push delivery v1:
 * - If campaign is active
 * - and includes push OR hybrid
 * - and schedule window passes
 * then emit a NotificationItem into your existing notifications KV list.
 *
 * `force=true` will emit even if already sent recently.
 */
export async function deliverCampaignPush(campaignId: string, force = false): Promise<{
  ok: boolean;
  reason?: string;
  notification?: NotificationItem | null;
  log?: DeliveryLog | null;
}> {
  const c = await getCampaign(campaignId);
  if (!c) return { ok: false, reason: "campaign_not_found" };

  if (c.status !== "active") return { ok: false, reason: "campaign_not_active" };
  const wantsPush = c.channels.includes("push") || c.channels.includes("hybrid");
  if (!wantsPush) return { ok: false, reason: "push_not_enabled" };
  if (!inWindow(c.schedule)) return { ok: false, reason: "outside_schedule_window" };

  const log = (await kvGetJSON<DeliveryLog>(deliveryKey(c.id))) ?? {
    campaignId: c.id,
    lastPushAt: null,
    pushCount: 0,
  };

  // simple anti-spam: 1 push per 5 minutes unless force
  const last = log.lastPushAt ? Date.parse(log.lastPushAt) : NaN;
  const now = Date.now();
  if (!force && Number.isFinite(last) && now - last < 5 * 60 * 1000) {
    return { ok: false, reason: "cooldown_5m", log };
  }

  const n = await addNotification({
    title: c.creative.title || c.name || "Sponsored",
    message: c.creative.message || "",
    type: "promo",
    unread: true,
    actionLabel: c.creative.actionLabel ?? "View",
    actionHref: c.creative.actionHref ?? "/mobile/explore",
    mediaUrl: c.creative.mediaUrl ?? "",
    mediaKind: c.creative.mediaKind ?? null,
    timeLabel: "just now",
  });

  const nextLog: DeliveryLog = {
    ...log,
    lastPushAt: new Date().toISOString(),
    pushCount: (log.pushCount || 0) + 1,
  };
  await kvSetJSON(deliveryKey(c.id), nextLog);

  await recordSponsoredPush({
    campaignId: c.id,
    note: `${c.name} | ${c.advertiserName}`.trim(),
  }).catch(() => null);

  return { ok: true, notification: n, log: nextLog };
}
