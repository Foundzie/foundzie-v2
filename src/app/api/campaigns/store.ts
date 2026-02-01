import "server-only";
import { kvGetJSON, kvSetJSON } from "@/lib/kv/redis";
import { addNotification, type NotificationItem } from "@/app/api/notifications/store";
import { recordSponsoredPush } from "@/app/api/health/store";
import { listUsers } from "@/app/api/users/store";

export type CampaignStatus = "draft" | "active" | "paused" | "ended";
export type CampaignChannel = "push" | "call" | "hybrid";

export type CampaignTargeting = {
  // v1
  roomIds?: string[];
  tags?: string[];
  city?: string;
  radiusKm?: number; // future
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
  startAt?: string | null;
  endAt?: string | null;
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

// ✅ per-room delivery log key (prevents spam to same user)
type RoomDeliveryLog = {
  campaignId: string;
  roomId: string;
  lastPushAt: string | null;
  pushCount: number;
};

function roomDeliveryKey(campaignId: string, roomId: string) {
  return `foundzie:campaign:delivery:${campaignId}:${roomId}:v1`;
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
      data?.schedule?.startAt !== undefined
        ? (data.schedule.startAt || null)
        : base.schedule?.startAt ?? null,
    endAt:
      data?.schedule?.endAt !== undefined
        ? (data.schedule.endAt || null)
        : base.schedule?.endAt ?? null,
  };

  const targeting: CampaignTargeting = {
    roomIds:
      data?.targeting?.roomIds !== undefined
        ? safeStringArray(data.targeting.roomIds)
        : base.targeting?.roomIds,
    tags:
      data?.targeting?.tags !== undefined
        ? safeStringArray(data.targeting.tags)
        : base.targeting?.tags,
    city:
      data?.targeting?.city !== undefined
        ? String(data.targeting.city || "").trim()
        : base.targeting?.city,
    radiusKm:
      data?.targeting?.radiusKm !== undefined
        ? Number(data.targeting.radiusKm || 0) || undefined
        : base.targeting?.radiusKm,
  };

  const creative: CampaignCreative = {
    title: String(data?.creative?.title ?? data?.title ?? base.creative.title ?? "").trim(),
    message: String(data?.creative?.message ?? data?.message ?? base.creative.message ?? "").trim(),
    actionLabel:
      String(data?.creative?.actionLabel ?? data?.actionLabel ?? base.creative.actionLabel ?? "").trim() || undefined,
    actionHref:
      String(data?.creative?.actionHref ?? data?.actionHref ?? base.creative.actionHref ?? "").trim() || undefined,
    mediaUrl:
      String(data?.creative?.mediaUrl ?? data?.mediaUrl ?? base.creative.mediaUrl ?? "").trim() || undefined,
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
  all.unshift(next);
  await saveAll(all);
  return { created: true, updated: false, item: next };
}

// ------------------- Targeting helpers ------------------------------------

function norm(s: string) {
  return String(s || "").trim().toLowerCase();
}

function userMatchesTags(userTags: string[], targetTags: string[]) {
  if (!targetTags.length) return true;
  const set = new Set(userTags.map(norm));
  return targetTags.some((t) => set.has(norm(t)));
}

function userMatchesCity(userTags: string[], city: string) {
  const c = norm(city);
  if (!c) return true;
  const set = new Set(userTags.map(norm));
  // supports tags like "city:Westmont"
  return set.has(`city:${c}`);
}

async function resolveTargetRoomIds(c: SponsoredCampaign): Promise<string[]> {
  const explicit = Array.isArray(c.targeting?.roomIds) ? c.targeting.roomIds.map(String).map((s) => s.trim()).filter(Boolean) : [];
  if (explicit.length) return Array.from(new Set(explicit));

  const targetTags = Array.isArray(c.targeting?.tags) ? c.targeting.tags : [];
  const city = String(c.targeting?.city || "").trim();

  // If no targeting rules, treat as broadcast (empty list means "global")
  if (!targetTags.length && !city) return [];

  const users = await listUsers().catch(() => []);
  const roomIds: string[] = [];

  for (const u of users as any[]) {
    const rid = String(u?.roomId || "").trim();
    if (!rid) continue;

    const tags = Array.isArray(u?.tags) ? u.tags.map(String) : [];
    const okTags = userMatchesTags(tags, targetTags);
    const okCity = userMatchesCity(tags, city);

    if (okTags && okCity) roomIds.push(rid);
  }

  return Array.from(new Set(roomIds));
}

// ------------------- Delivery (push) --------------------------------------

/**
 * Push delivery v1.1 (targeting):
 * - campaign must be active and within schedule
 * - delivers to matching roomIds if targeting is set
 * - if targeting is empty => broadcast notification (global)
 *
 * `force=true` bypasses per-room cooldown.
 */
export async function deliverCampaignPush(
  campaignId: string,
  force = false
): Promise<{
  ok: boolean;
  reason?: string;
  deliveredCount?: number;
  targetRoomIds?: string[];
  notification?: NotificationItem | null; // for broadcast case
  notificationsCreated?: number;
  skippedRooms?: Array<{ roomId: string; reason: string }>;
}> {
  const c = await getCampaign(campaignId);
  if (!c) return { ok: false, reason: "campaign_not_found" };

  if (c.status !== "active") return { ok: false, reason: "campaign_not_active" };
  const wantsPush = c.channels.includes("push") || c.channels.includes("hybrid");
  if (!wantsPush) return { ok: false, reason: "push_not_enabled" };
  if (!inWindow(c.schedule)) return { ok: false, reason: "outside_schedule_window" };

  // cooldown per room (default 6h)
  const cooldownMs = Number(process.env.CAMPAIGN_PUSH_COOLDOWN_MS || String(6 * 60 * 60 * 1000));

  const targetRoomIds = await resolveTargetRoomIds(c);

  // ✅ Broadcast mode (no targeting rules)
  if (targetRoomIds.length === 0 && !c.targeting?.tags?.length && !c.targeting?.city && !c.targeting?.roomIds?.length) {
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
      campaignId: c.id,
      targetRoomIds: null, // global
    });

    await recordSponsoredPush({
      campaignId: c.id,
      note: `${c.name} | ${c.advertiserName}`.trim(),
    }).catch(() => null);

    return { ok: true, deliveredCount: 1, notification: n, notificationsCreated: 1, targetRoomIds: [] };
  }

  // ✅ Targeted mode: create per-room notifications with targetRoomIds=[roomId]
  let created = 0;
  const skippedRooms: Array<{ roomId: string; reason: string }> = [];

  for (const roomId of targetRoomIds) {
    const key = roomDeliveryKey(c.id, roomId);
    const log = (await kvGetJSON<RoomDeliveryLog>(key)) ?? {
      campaignId: c.id,
      roomId,
      lastPushAt: null,
      pushCount: 0,
    };

    const last = log.lastPushAt ? Date.parse(log.lastPushAt) : NaN;
    const now = Date.now();
    if (!force && Number.isFinite(last) && now - last < cooldownMs) {
      skippedRooms.push({ roomId, reason: "cooldown" });
      continue;
    }

    await addNotification({
      title: c.creative.title || c.name || "Sponsored",
      message: c.creative.message || "",
      type: "promo",
      unread: true,
      actionLabel: c.creative.actionLabel ?? "View",
      actionHref: c.creative.actionHref ?? "/mobile/explore",
      mediaUrl: c.creative.mediaUrl ?? "",
      mediaKind: c.creative.mediaKind ?? null,
      timeLabel: "just now",
      campaignId: c.id,
      targetRoomIds: [roomId],
      deliveredToRoomId: roomId,
    });

    const nextLog: RoomDeliveryLog = {
      ...log,
      lastPushAt: new Date().toISOString(),
      pushCount: (log.pushCount || 0) + 1,
    };
    await kvSetJSON(key, nextLog);

    created += 1;
  }

  await recordSponsoredPush({
    campaignId: c.id,
    note: `${c.name} | ${c.advertiserName} | delivered=${created}`.trim(),
  }).catch(() => null);

  return {
    ok: true,
    deliveredCount: created,
    notificationsCreated: created,
    targetRoomIds,
    skippedRooms,
  };
}
