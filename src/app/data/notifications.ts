// src/app/data/notifications.ts

export type NotificationType = "system" | "event" | "offer" | "chat";

// Shared media kind type (used by tools.ts as well)
export type MediaKind = "image" | "gif" | "link" | "other";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string; // e.g. "2h ago"
  unread: boolean;

  // existing action (used as main link)
  actionLabel?: string;
  actionHref?: string;

  // optional media support
  mediaUrl?: string;
  mediaKind?: MediaKind | null;
  mediaId?: string | null;
}

// Your starter notifications
export const mockNotifications: AppNotification[] = [
  {
    id: "1",
    type: "system",
    title: "Welcome to Foundzie 🌍",
    message: "Tap around the Explore and Nearby tabs to see places near you.",
    time: "2h ago",
    unread: true,
  },
  {
    id: "2",
    type: "offer",
    title: "15% off at GMEA",
    message: "You're close to GMEA in Downers Grove. Want to book?",
    time: "3h ago",
    unread: true,
    actionLabel: "View",
    actionHref: "/mobile/explore",
    // example image (you can change this to a real URL later)
    mediaUrl: "https://via.placeholder.com/600x320.png?text=GMEA+Offer",
    mediaKind: "image",
    mediaId: null,
  },
  {
    id: "3",
    type: "event",
    title: "Tonight in your area",
    message: "Live music and family-friendly events nearby.",
    time: "yesterday",
    unread: false,
  },
];
