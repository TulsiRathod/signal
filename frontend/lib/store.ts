import { create } from "zustand";
import { api, clearToken } from "./api";
import type { Conversation, Message, User } from "./types";
import { wsClient, type WsEvent } from "./ws";

interface Presence {
  is_online: boolean;
  last_seen: string;
}

interface Toast {
  id: number;
  text: string;
}

interface StoreState {
  currentUser: User | null;
  conversations: Conversation[];
  activeConvId: number | null;
  messages: Record<number, Message[]>;
  typing: Record<number, number[]>; // convId -> user ids currently typing
  presence: Record<number, Presence>;
  connected: boolean;
  loadingConvs: boolean;
  toasts: Toast[];

  bootstrap: () => Promise<void>;
  logout: () => void;
  loadConversations: () => Promise<void>;
  setActiveConv: (id: number | null) => Promise<void>;
  sendMessage: (data: {
    content?: string;
    type?: string;
    reply_to_id?: number | null;
    disappear_after?: number | null;
    attachments?: { url: string; type: string; filename?: string | null; size?: number | null }[];
  }) => Promise<void>;
  toggleReaction: (messageId: number, emoji: string) => Promise<void>;
  deleteMessage: (messageId: number) => Promise<void>;
  sendTyping: (start: boolean) => void;
  upsertConversation: (conv: Conversation) => void;
  isOnline: (userId: number) => boolean;
  lastSeen: (userId: number) => string | null;
  pushToast: (text: string) => void;
  dismissToast: (id: number) => void;
  handleWsEvent: (event: WsEvent) => void;
}

let toastSeq = 1;
let wsWired = false; // guard against duplicate handler registration (Strict Mode)

export const useStore = create<StoreState>((set, get) => ({
  currentUser: null,
  conversations: [],
  activeConvId: null,
  messages: {},
  typing: {},
  presence: {},
  connected: false,
  loadingConvs: false,
  toasts: [],

  bootstrap: async () => {
    const user = await api.me();
    set({ currentUser: user });
    await get().loadConversations();
    if (!wsWired) {
      wsWired = true;
      wsClient.onConnectionChange((c) => set({ connected: c }));
      wsClient.on((e) => get().handleWsEvent(e));
    }
    wsClient.connect();
  },

  logout: () => {
    wsClient.disconnect();
    clearToken();
    set({
      currentUser: null,
      conversations: [],
      messages: {},
      activeConvId: null,
    });
  },

  loadConversations: async () => {
    set({ loadingConvs: true });
    const convs = await api.listConversations();
    const presence = { ...get().presence };
    for (const c of convs) {
      for (const m of c.members) {
        presence[m.user.id] = {
          is_online: m.user.is_online,
          last_seen: m.user.last_seen,
        };
      }
    }
    set({ conversations: convs, presence, loadingConvs: false });
  },

  setActiveConv: async (id) => {
    set({ activeConvId: id });
    if (id == null) return;
    if (!get().messages[id]) {
      const msgs = await api.getMessages(id);
      set((s) => ({ messages: { ...s.messages, [id]: msgs } }));
    }
    // Mark the latest message read and clear unread badge.
    const msgs = get().messages[id] || [];
    const last = msgs[msgs.length - 1];
    const me = get().currentUser?.id;
    if (last && last.sender_id !== me) {
      api.markRead(last.id).catch(() => {});
    }
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, unread_count: 0 } : c
      ),
    }));
  },

  sendMessage: async (data) => {
    const convId = get().activeConvId;
    const me = get().currentUser;
    if (convId == null || !me) return;

    const localId = `tmp-${Date.now()}-${Math.random()}`;
    const optimistic: Message = {
      id: -Date.now(),
      _localId: localId,
      conversation_id: convId,
      sender_id: me.id,
      content: data.content || "",
      type: (data.type as Message["type"]) || "text",
      status: "sending",
      reply_to_id: data.reply_to_id ?? null,
      disappear_after: data.disappear_after ?? null,
      is_deleted: false,
      edited_at: null,
      created_at: new Date().toISOString(),
      reactions: [],
      attachments: (data.attachments || []).map((a, i) => ({
        id: -i - 1,
        url: a.url,
        type: a.type,
        filename: a.filename ?? null,
        size: a.size ?? null,
      })),
      reply_to: null,
      read_by: [],
    };
    set((s) => ({
      messages: {
        ...s.messages,
        [convId]: [...(s.messages[convId] || []), optimistic],
      },
    }));

    try {
      const saved = await api.sendMessage({
        conversation_id: convId,
        ...data,
      });
      // Replace the optimistic message with the saved one.
      set((s) => ({
        messages: {
          ...s.messages,
          [convId]: (s.messages[convId] || [])
            .filter((m) => m._localId !== localId)
            .some((m) => m.id === saved.id)
            ? (s.messages[convId] || []).filter((m) => m._localId !== localId)
            : [
                ...(s.messages[convId] || []).filter(
                  (m) => m._localId !== localId
                ),
                saved,
              ],
        },
      }));
      set((s) => ({
        conversations: sortConvs(
          s.conversations.map((c) =>
            c.id === convId
              ? { ...c, last_message: saved, updated_at: saved.created_at }
              : c
          )
        ),
      }));
    } catch {
      // Mark optimistic message as failed (kept simple: drop it + toast).
      set((s) => ({
        messages: {
          ...s.messages,
          [convId]: (s.messages[convId] || []).filter(
            (m) => m._localId !== localId
          ),
        },
      }));
      get().pushToast("Failed to send message");
    }
  },

  toggleReaction: async (messageId, emoji) => {
    try {
      await api.toggleReaction(messageId, emoji);
    } catch {
      get().pushToast("Could not react");
    }
  },

  deleteMessage: async (messageId) => {
    try {
      await api.deleteMessage(messageId);
    } catch {
      get().pushToast("Could not delete");
    }
  },

  sendTyping: (start) => {
    const convId = get().activeConvId;
    if (convId == null) return;
    wsClient.send({
      type: start ? "typing.start" : "typing.stop",
      payload: { conversation_id: convId },
    });
  },

  upsertConversation: (conv) => {
    set((s) => {
      const others = s.conversations.filter((c) => c.id !== conv.id);
      return { conversations: sortConvs([conv, ...others]) };
    });
  },

  isOnline: (userId) => !!get().presence[userId]?.is_online,
  lastSeen: (userId) => get().presence[userId]?.last_seen ?? null,

  pushToast: (text) => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, text }] }));
    setTimeout(() => get().dismissToast(id), 3500);
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  handleWsEvent: (event) => {
    const { type, payload } = event;
    const state = get();
    const me = state.currentUser?.id;

    switch (type) {
      case "message.new": {
        const msg = payload as Message;
        const convId = msg.conversation_id;
        set((s) => {
          const existing = s.messages[convId] || [];
          let next: Message[];
          if (existing.some((m) => m.id === msg.id)) {
            next = existing.map((m) => (m.id === msg.id ? msg : m));
          } else {
            // Drop a matching optimistic temp from self before adding.
            next = [
              ...existing.filter(
                (m) =>
                  !(
                    m._localId &&
                    m.sender_id === msg.sender_id &&
                    m.content === msg.content
                  )
              ),
              msg,
            ];
          }
          return { messages: { ...s.messages, [convId]: next } };
        });
        // Update conversation preview + ordering + unread.
        set((s) => ({
          conversations: sortConvs(
            s.conversations.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    last_message: msg,
                    updated_at: msg.created_at,
                    unread_count:
                      s.activeConvId === convId
                        ? 0
                        : msg.sender_id !== me
                        ? c.unread_count + 1
                        : c.unread_count,
                  }
                : c
            )
          ),
        }));
        // If the conversation is open and message is from someone else, read it.
        if (msg.sender_id !== me && state.activeConvId === convId) {
          api.markRead(msg.id).catch(() => {});
        } else if (msg.sender_id !== me) {
          maybeNotify(state, convId, msg);
        }
        break;
      }

      case "message.status": {
        const { message_id, message_ids, status } = payload;
        const ids: number[] = message_ids || (message_id ? [message_id] : []);
        const readerId: number | undefined = payload.reader_id;
        set((s) => {
          const next = { ...s.messages };
          for (const convId of Object.keys(next)) {
            next[+convId] = next[+convId].map((m) => {
              if (!ids.includes(m.id)) return m;
              const read_by =
                status === "read" && readerId && !m.read_by.includes(readerId)
                  ? [...m.read_by, readerId]
                  : m.read_by;
              return { ...m, status, read_by };
            });
          }
          return { messages: next };
        });
        break;
      }

      case "reaction.update": {
        const msg = payload as Message;
        set((s) => ({
          messages: {
            ...s.messages,
            [msg.conversation_id]: (s.messages[msg.conversation_id] || []).map(
              (m) => (m.id === msg.id ? { ...m, reactions: msg.reactions } : m)
            ),
          },
        }));
        break;
      }

      case "typing.start":
      case "typing.stop": {
        const { conversation_id, user_id } = payload;
        if (user_id === me) break;
        set((s) => {
          const current = s.typing[conversation_id] || [];
          const next =
            type === "typing.start"
              ? Array.from(new Set([...current, user_id]))
              : current.filter((u) => u !== user_id);
          return { typing: { ...s.typing, [conversation_id]: next } };
        });
        if (type === "typing.start") {
          // Auto-clear after a few seconds in case stop is missed.
          setTimeout(() => {
            set((s) => ({
              typing: {
                ...s.typing,
                [conversation_id]: (s.typing[conversation_id] || []).filter(
                  (u) => u !== user_id
                ),
              },
            }));
          }, 4000);
        }
        break;
      }

      case "presence.update": {
        const { user_id, is_online, last_seen } = payload;
        set((s) => ({
          presence: { ...s.presence, [user_id]: { is_online, last_seen } },
        }));
        break;
      }

      case "presence.bulk": {
        const online: number[] = payload.online || [];
        set((s) => {
          const presence = { ...s.presence };
          for (const uid of online) {
            presence[uid] = {
              is_online: true,
              last_seen: presence[uid]?.last_seen || new Date().toISOString(),
            };
          }
          return { presence };
        });
        break;
      }

      case "conversation.new":
      case "member.update": {
        get().upsertConversation(payload as Conversation);
        // Refresh messages for active conv to pick up system messages.
        const convId = (payload as Conversation).id;
        if (state.activeConvId === convId) {
          api.getMessages(convId).then((msgs) =>
            set((s) => ({ messages: { ...s.messages, [convId]: msgs } }))
          );
        }
        break;
      }
    }
  },
}));

function sortConvs(convs: Conversation[]): Conversation[] {
  return [...convs].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

function maybeNotify(state: any, convId: number, msg: Message) {
  const conv = state.conversations.find((c: Conversation) => c.id === convId);
  if (!conv) return;
  const sender = conv.members.find((m: any) => m.user.id === msg.sender_id);
  const name = sender?.user.display_name || "New message";
  state.pushToast(`${name}: ${msg.content || "Sent an attachment"}`);
}
