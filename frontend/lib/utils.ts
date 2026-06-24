import { format, isToday, isYesterday, isThisWeek, isThisYear } from "date-fns";
import type { Conversation, User } from "./types";

// Signal-like avatar background palette.
const AVATAR_COLORS = [
  "#5e7fb3", "#6b8e7f", "#b39c5e", "#a86b8e", "#6b6bb3",
  "#b36b6b", "#5eb3a8", "#8e6bb3", "#b3895e", "#6ba8b3",
];

export function avatarColor(seed: number | string): string {
  const n =
    typeof seed === "number"
      ? seed
      : seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[Math.abs(n) % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The "other" user in a direct conversation, relative to the current user. */
export function otherMember(conv: Conversation, meId: number): User | null {
  if (conv.type !== "direct") return null;
  const m = conv.members.find((mm) => mm.user.id !== meId);
  return m?.user ?? null;
}

export function conversationTitle(conv: Conversation, meId: number): string {
  if (conv.type === "group") return conv.name || "Group";
  return otherMember(conv, meId)?.display_name || "Unknown";
}

/** Short timestamp for conversation list (Signal style). */
export function listTime(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  if (isThisWeek(d)) return format(d, "EEE");
  if (isThisYear(d)) return format(d, "MMM d");
  return format(d, "MM/dd/yy");
}

/** Time shown next to a message bubble. */
export function bubbleTime(iso: string): string {
  return format(new Date(iso), "h:mm a");
}

/** Day separator label inside a thread. */
export function daySeparator(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  if (isThisYear(d)) return format(d, "EEEE, MMMM d");
  return format(d, "MMMM d, yyyy");
}

export function lastSeenText(iso: string | null): string {
  if (!iso) return "offline";
  const d = new Date(iso);
  if (isToday(d)) return `last seen today at ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return `last seen yesterday at ${format(d, "h:mm a")}`;
  return `last seen ${format(d, "MMM d")}`;
}

export function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** Compact label for a disappearing-messages duration, e.g. 300 -> "5m". */
export function disappearLabel(seconds: number): string {
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}
