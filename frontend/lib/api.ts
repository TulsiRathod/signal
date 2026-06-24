import type {
  Conversation,
  Message,
  User,
} from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TOKEN_KEY = "signal_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/** Resolve a backend-relative upload path to an absolute URL. */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  is_new_user: boolean;
  user: User;
}

export const api = {
  requestOtp: (phone: string) =>
    request<{ ok: boolean; hint: string }>("/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
    }),

  verifyOtp: (phone: string, otp: string) =>
    request<TokenResponse>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, otp }),
    }),

  completeProfile: (data: {
    display_name: string;
    avatar_url?: string | null;
    username?: string | null;
    about?: string | null;
  }) =>
    request<User>("/auth/complete-profile", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: () => request<User>("/auth/me"),

  updateMe: (data: Partial<Pick<User, "display_name" | "username" | "avatar_url" | "about">>) =>
    request<User>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),

  searchUsers: (q: string) =>
    request<User[]>(`/users/search?q=${encodeURIComponent(q)}`),

  listContacts: () => request<{ id: number; nickname: string | null; contact_user: User }[]>("/contacts"),

  addContact: (data: { phone?: string; user_id?: number; nickname?: string }) =>
    request("/contacts", { method: "POST", body: JSON.stringify(data) }),

  listConversations: () => request<Conversation[]>("/conversations"),

  createConversation: (data: {
    type: "direct" | "group";
    member_ids: number[];
    name?: string;
  }) =>
    request<Conversation>("/conversations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMessages: (convId: number, before?: number) =>
    request<Message[]>(
      `/conversations/${convId}/messages${before ? `?before=${before}` : ""}`
    ),

  sendMessage: (data: {
    conversation_id: number;
    content?: string;
    type?: string;
    reply_to_id?: number | null;
    disappear_after?: number | null;
    attachments?: { url: string; type: string; filename?: string | null; size?: number | null }[];
  }) =>
    request<Message>("/messages", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  markRead: (messageId: number) =>
    request<{ ok: boolean }>(`/messages/${messageId}/read`, { method: "POST" }),

  toggleReaction: (messageId: number, emoji: string) =>
    request<Message>(`/messages/${messageId}/reactions`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    }),

  deleteMessage: (messageId: number) =>
    request<Message>(`/messages/${messageId}`, { method: "DELETE" }),

  setDisappearing: (convId: number, seconds: number | null) =>
    request<Conversation>(`/conversations/${convId}/disappearing`, {
      method: "PATCH",
      body: JSON.stringify({ seconds }),
    }),

  addMembers: (convId: number, userIds: number[]) =>
    request<Conversation>(`/conversations/${convId}/members`, {
      method: "POST",
      body: JSON.stringify({ user_ids: userIds }),
    }),

  removeMember: (convId: number, userId: number) =>
    request<Conversation>(`/conversations/${convId}/members/${userId}`, {
      method: "DELETE",
    }),

  uploadAttachment: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ url: string; filename: string; size: number; type: string }>(
      "/attachments",
      { method: "POST", body: fd }
    );
  },
};
