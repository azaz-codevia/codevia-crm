export const STATUSES = ["new", "contacted", "qualified", "meeting", "proposal", "negotiation", "won", "lost"] as const;
export type Status = (typeof STATUSES)[number];
export const OPEN_STATUSES: Status[] = ["new", "contacted", "qualified", "meeting", "proposal", "negotiation"];

export const SOURCES = ["discovery", "website", "whatsapp", "referral", "social", "ads", "event", "excel_import", "manual", "other"] as const;
export type Source = (typeof SOURCES)[number];

export const SERVICES = ["erp", "government", "web_app", "mobile_app", "ai_automation", "ecommerce", "integration", "support", "other"] as const;
export type Service = (typeof SERVICES)[number];

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ROLES = ["admin", "manager", "agent"] as const;
export type Role = (typeof ROLES)[number];

export const MEETING_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

/** Colour token per pipeline stage (see globals.css). */
export const STATUS_TONE: Record<Status, string> = {
  new: "tone-new",
  contacted: "tone-contacted",
  qualified: "tone-qualified",
  meeting: "tone-meeting",
  proposal: "tone-proposal",
  negotiation: "tone-negotiation",
  won: "tone-won",
  lost: "tone-lost",
};

export const STATUS_HEX: Record<Status, string> = {
  new: "#E8E9E3",
  contacted: "#7CC4E4",
  qualified: "#A99BF0",
  meeting: "#E8B85C",
  proposal: "#E48B5C",
  negotiation: "#D5E77A",
  won: "#B8D433",
  lost: "#E06464",
};

export const PAGE_SIZE = 25;

export function isStatus(v: unknown): v is Status {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}
export function isSource(v: unknown): v is Source {
  return typeof v === "string" && (SOURCES as readonly string[]).includes(v);
}
export function isPriority(v: unknown): v is Priority {
  return typeof v === "string" && (PRIORITIES as readonly string[]).includes(v);
}
export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}
