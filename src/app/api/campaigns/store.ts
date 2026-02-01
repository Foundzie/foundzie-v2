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

/* ------------------------------------------------------------------ */
/*  M21c.3: Delivery logs + stats                                      */
/* ------------------------------------------------------------------ */

// ✅ per-room delivery log key (prevents spam to same user)
export type RoomDeliveryLog = {
  campaignId: string;
  roomId: string;
  firstPushAt: string | null;
  lastPushAt: string | null;
  pushCount: number;
};

function roomDeliveryKey(campaignId: string, roomId: string) {
  return `foundzie:campaign:delivery:${campaignId}:${roomId}:v1`;
}

// ✅ per-campaign aggregate stats (persisted reporting)
export type CampaignDeliveryStats = {
  campaignId: string;

  totalDeliverRuns: number;        // "deliver push now" actions
  totalTargetsEvaluated: number;   // total rooms evaluated across runs
  totalDelivered: number;          // notifications created across runs
  totalSkipped: number;            // skipped across runs

  skippedByReason: Record<string, number>;

  lastRunAt: string | null;
  lastDeliveredAt: string | null;  // last time any notification was created
  lastRunSummary?: {
    delivered: number;
    skipped: number;
    skippedByReason: Record<string, number>;
    targetCount: number;
    forced?: boolean;
    scheduler?: boolean;
  } | null;
};

function campaignStatsKey(campaignId: string) {
  return `foundzie:campaign:stats:${campaignId}:v1`;
}

function defaultCampaignStats(campaignId: string): CampaignDeliveryStats {
  return {
    campaignId,
    totalDeliverRuns: 0,
    totalTargetsEvaluated: 0,
    totalDelivered: 0,
    totalSkipped: 0,
    skippedByReason: {},
    lastRunAt: null,
    lastDeliveredAt: null,
    lastRunSummary: null,
  };
}

function bumpMap(map: Record<string, number>, key: string, n = 1) {
  map[key] = (map[key] || 0) + n;
}

/* ------------------------------------------------------------------ */

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
      String(data?.creative?.actionLabel ?? data?.actionLabel ?? base.creative.actionLabel ?? "").trim() ||
      undefined,
    actionHref:
      String(data?.creative?.actionHref ?? data?.actionHref ?? base.creative.actionHref ?? "").trim() ||
      undefined,
    mediaUrl:
      String(data?.creative?.mediaUrl ?? data?.mediaUrl ?? base.creative.mediaUrl ?? "").trim() ||
      undefined,
    mediaKind: (data?.creative?.mediaKind ?? data?.mediaKind ?? base.creative.mediaKind ?? null) as any,
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

/* ------------------------------------------------------------------ */
/*  Targeting helpers                                                 */
/* ------------------------------------------------------------------ */

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
  const explicit = Array.isArray(c.targeting?.roomIds)
    ? c.targeting.roomIds.map(String).map((s) => s.trim()).filter(Boolean)
    : [];
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

/* ------------------------------------------------------------------ */
/*  Delivery (push) — M21c.4 already implemented                       */
/* ------------------------------------------------------------------ */

export type DeliverySkipReason =
  | "cooldown"
  | "no_targets"
  | "campaign_not_active"
  | "push_not_enabled"
  | "outside_schedule_window"
  | "campaign_not_found"
  | "broadcast";

export type CampaignDeliveryResult = {
  ok: boolean;
  reason?: DeliverySkipReason | string;

  mode?: "broadcast" | "targeted";

  targetRoomIds?: string[];
  targetCount?: number;

  deliveredCount?: number;
  skippedCount?: number;

  skippedByReason?: Record<string, number>;
  skippedRooms?: Array<{ roomId: string; reason: string }>;

  notification?: NotificationItem | null;

  stats?: CampaignDeliveryStats | null;

  ranAt?: string;
  lastDeliveredAt?: string | null;
};

/**
 * Push delivery (respects schedule + targeting + cooldown unless force=true).
 */
export async function deliverCampaignPush(
  campaignId: string,
  force = false,
  opts?: { scheduler?: boolean }
): Promise<CampaignDeliveryResult> {
  const ranAt = nowIso();
  const scheduler = opts?.scheduler === true;

  const c = await getCampaign(campaignId);
  if (!c) return { ok: false, reason: "campaign_not_found", ranAt };

  if (c.status !== "active") return { ok: false, reason: "campaign_not_active", ranAt };

  const wantsPush = c.channels.includes("push") || c.channels.includes("hybrid");
  if (!wantsPush) return { ok: false, reason: "push_not_enabled", ranAt };

  if (!inWindow(c.schedule)) return { ok: false, reason: "outside_schedule_window", ranAt };

  const cooldownMs = Number(process.env.CAMPAIGN_PUSH_COOLDOWN_MS || String(6 * 60 * 60 * 1000));
  const cooldownMsSafe = Number.isFinite(cooldownMs) && cooldownMs > 0 ? cooldownMs : 6 * 60 * 60 * 1000;

  const existingStats =
    (await kvGetJSON<CampaignDeliveryStats>(campaignStatsKey(c.id)).catch(() => null)) ?? defaultCampaignStats(c.id);

  const skippedByReason: Record<string, number> = {};
  const skippedRooms: Array<{ roomId: string; reason: string }> = [];

  const targetRoomIds = await resolveTargetRoomIds(c);

  const hasAnyTargeting =
    (Array.isArray(c.targeting?.roomIds) && c.targeting!.roomIds!.length > 0) ||
    (Array.isArray(c.targeting?.tags) && c.targeting!.tags!.length > 0) ||
    (String(c.targeting?.city || "").trim().length > 0);

  // Broadcast mode
  if (!hasAnyTargeting) {
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

    const nextStats: CampaignDeliveryStats = {
      ...existingStats,
      totalDeliverRuns: existingStats.totalDeliverRuns + 1,
      totalTargetsEvaluated: existingStats.totalTargetsEvaluated + 1,
      totalDelivered: existingStats.totalDelivered + 1,
      totalSkipped: existingStats.totalSkipped + 0,
      skippedByReason: { ...existingStats.skippedByReason },
      lastRunAt: ranAt,
      lastDeliveredAt: ranAt,
      lastRunSummary: {
        delivered: 1,
        skipped: 0,
        skippedByReason: {},
        targetCount: 1,
        forced: force,
        scheduler,
      },
    };

    await kvSetJSON(campaignStatsKey(c.id), nextStats).catch(() => null);

    await recordSponsoredPush({
      campaignId: c.id,
      delivered: 1,
      skipped: 0,
      skippedByReason: {},
      note: `${c.name} | ${c.advertiserName} | broadcast${force ? " | force" : ""}${scheduler ? " | scheduler" : ""}`.trim(),
    }).catch(() => null);

    return {
      ok: true,
      mode: "broadcast",
      deliveredCount: 1,
      skippedCount: 0,
      skippedByReason: {},
      targetRoomIds: [],
      targetCount: 1,
      notification: n,
      stats: nextStats,
      ranAt,
      lastDeliveredAt: ranAt,
    };
  }

  // Targeted mode: no matches
  if (targetRoomIds.length === 0) {
    bumpMap(skippedByReason, "no_targets", 1);

    const nextStats: CampaignDeliveryStats = {
      ...existingStats,
      totalDeliverRuns: existingStats.totalDeliverRuns + 1,
      totalTargetsEvaluated: existingStats.totalTargetsEvaluated + 0,
      totalDelivered: existingStats.totalDelivered + 0,
      totalSkipped: existingStats.totalSkipped + 0,
      skippedByReason: { ...existingStats.skippedByReason },
      lastRunAt: ranAt,
      lastDeliveredAt: existingStats.lastDeliveredAt,
      lastRunSummary: {
        delivered: 0,
        skipped: 0,
        skippedByReason: { no_targets: 1 },
        targetCount: 0,
        forced: force,
        scheduler,
      },
    };

    bumpMap(nextStats.skippedByReason, "no_targets", 1);
    await kvSetJSON(campaignStatsKey(c.id), nextStats).catch(() => null);

    await recordSponsoredPush({
      campaignId: c.id,
      delivered: 0,
      skipped: 0,
      skippedByReason: { no_targets: 1 },
      note: `${c.name} | ${c.advertiserName} | no_targets${force ? " | force" : ""}${scheduler ? " | scheduler" : ""}`.trim(),
    }).catch(() => null);

    return {
      ok: true,
      mode: "targeted",
      reason: "no_targets",
      targetRoomIds: [],
      targetCount: 0,
      deliveredCount: 0,
      skippedCount: 0,
      skippedByReason: { no_targets: 1 },
      skippedRooms: [],
      stats: nextStats,
      ranAt,
      lastDeliveredAt: nextStats.lastDeliveredAt,
    };
  }

  let created = 0;

  for (const roomId of targetRoomIds) {
    const key = roomDeliveryKey(c.id, roomId);

    const log =
      (await kvGetJSON<RoomDeliveryLog>(key).catch(() => null)) ?? {
        campaignId: c.id,
        roomId,
        firstPushAt: null,
        lastPushAt: null,
        pushCount: 0,
      };

    const last = log.lastPushAt ? Date.parse(log.lastPushAt) : NaN;
    const now = Date.now();

    if (!force && Number.isFinite(last) && now - last < cooldownMsSafe) {
      skippedRooms.push({ roomId, reason: "cooldown" });
      bumpMap(skippedByReason, "cooldown", 1);
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
      // NOTE: your notification scoping is already handled in your notifications layer.
    });

    const nextLog: RoomDeliveryLog = {
      ...log,
      firstPushAt: log.firstPushAt ?? ranAt,
      lastPushAt: ranAt,
      pushCount: (log.pushCount || 0) + 1,
    };
    await kvSetJSON(key, nextLog).catch(() => null);

    created += 1;
  }

  const skippedCount = skippedRooms.length;

  const nextStats: CampaignDeliveryStats = {
    ...existingStats,
    totalDeliverRuns: existingStats.totalDeliverRuns + 1,
    totalTargetsEvaluated: existingStats.totalTargetsEvaluated + targetRoomIds.length,
    totalDelivered: existingStats.totalDelivered + created,
    totalSkipped: existingStats.totalSkipped + skippedCount,
    skippedByReason: { ...existingStats.skippedByReason },
    lastRunAt: ranAt,
    lastDeliveredAt: created > 0 ? ranAt : existingStats.lastDeliveredAt,
    lastRunSummary: {
      delivered: created,
      skipped: skippedCount,
      skippedByReason: { ...skippedByReason },
      targetCount: targetRoomIds.length,
      forced: force,
      scheduler,
    },
  };

  for (const [k, v] of Object.entries(skippedByReason)) {
    bumpMap(nextStats.skippedByReason, k, v);
  }

  await kvSetJSON(campaignStatsKey(c.id), nextStats).catch(() => null);

  await recordSponsoredPush({
    campaignId: c.id,
    delivered: created,
    skipped: skippedCount,
    skippedByReason,
    note: `${c.name} | ${c.advertiserName} | targeted${force ? " | force" : ""}${scheduler ? " | scheduler" : ""}`.trim(),
  }).catch(() => null);

  return {
    ok: true,
    mode: "targeted",
    targetRoomIds,
    targetCount: targetRoomIds.length,
    deliveredCount: created,
    skippedCount,
    skippedByReason,
    skippedRooms,
    stats: nextStats,
    ranAt,
    lastDeliveredAt: nextStats.lastDeliveredAt,
  };
}

/* ------------------------------------------------------------------ */
/*  M21c.5 — Scheduler                                                 */
/* ------------------------------------------------------------------ */

export type SchedulerRunSummary = {
  ok: true;
  ranAt: string;
  checked: number;
  attempted: number;
  deliveredCampaigns: number;
  skippedCampaigns: number;
  results: Array<{
    campaignId: string;
    name: string;
    status: CampaignStatus;
    reason?: string;
    delivered?: number;
    skipped?: number;
    mode?: "broadcast" | "targeted";
  }>;
};

export async function runDueCampaigns(): Promise<SchedulerRunSummary> {
  const ranAt = nowIso();
  const all = await loadAll();

  const active = all.filter((c) => c && c.status === "active");
  const results: SchedulerRunSummary["results"] = [];

  let attempted = 0;
  let deliveredCampaigns = 0;
  let skippedCampaigns = 0;

  for (const c of active) {
    // We attempt only if push/hybrid includes push
    const wantsPush = Array.isArray(c.channels) && (c.channels.includes("push") || c.channels.includes("hybrid"));
    if (!wantsPush) {
      skippedCampaigns += 1;
      results.push({
        campaignId: c.id,
        name: c.name,
        status: c.status,
        reason: "push_not_enabled",
        delivered: 0,
        skipped: 0,
      });
      continue;
    }

    // Respect schedule window
    if (!inWindow(c.schedule)) {
      skippedCampaigns += 1;
      results.push({
        campaignId: c.id,
        name: c.name,
        status: c.status,
        reason: "outside_schedule_window",
        delivered: 0,
        skipped: 0,
      });
      continue;
    }

    attempted += 1;

    // Scheduler ALWAYS respects cooldown: force=false
    const d = await deliverCampaignPush(c.id, false, { scheduler: true });

    if (!d.ok) {
      skippedCampaigns += 1;
      results.push({
        campaignId: c.id,
        name: c.name,
        status: c.status,
        reason: d.reason || "unknown",
        delivered: 0,
        skipped: 0,
        mode: d.mode,
      });
      continue;
    }

    const delivered = Number(d.deliveredCount || 0);
    const skipped = Number(d.skippedCount || 0);

    if (delivered > 0) deliveredCampaigns += 1;
    else skippedCampaigns += 1;

    results.push({
      campaignId: c.id,
      name: c.name,
      status: c.status,
      delivered,
      skipped,
      mode: d.mode,
      reason: d.reason,
    });
  }

  return {
    ok: true,
    ranAt,
    checked: all.length,
    attempted,
    deliveredCampaigns,
    skippedCampaigns,
    results,
  };
}
