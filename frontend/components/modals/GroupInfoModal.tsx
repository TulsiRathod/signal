"use client";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Conversation, User } from "@/lib/types";
import { conversationTitle, lastSeenText, otherMember } from "@/lib/utils";
import { Crown, LogOut, Search, UserMinus, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  conversation: Conversation;
}

export default function GroupInfoModal({ open, onClose, conversation }: Props) {
  const me = useStore((s) => s.currentUser)!;
  const setActiveConv = useStore((s) => s.setActiveConv);
  const upsertConversation = useStore((s) => s.upsertConversation);
  const loadConversations = useStore((s) => s.loadConversations);
  const pushToast = useStore((s) => s.pushToast);
  const isOnline = useStore((s) => s.isOnline);
  const lastSeen = useStore((s) => s.lastSeen);

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);

  const myMember = conversation.members.find((m) => m.user.id === me.id);
  const amAdmin = myMember?.role === "admin";
  const isGroup = conversation.type === "group";

  useEffect(() => {
    if (!open) {
      setAdding(false);
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!adding) return;
    const q = query.trim();
    if (!q) return setResults([]);
    const t = setTimeout(async () => {
      const found = await api.searchUsers(q);
      const existing = new Set(conversation.members.map((m) => m.user.id));
      setResults(found.filter((u) => !existing.has(u.id)));
    }, 250);
    return () => clearTimeout(t);
  }, [query, adding, conversation.members]);

  async function addMember(u: User) {
    try {
      const conv = await api.addMembers(conversation.id, [u.id]);
      upsertConversation(conv);
      setQuery("");
      setResults([]);
      pushToast(`Added ${u.display_name.split(" ")[0]}`);
    } catch (e: any) {
      pushToast(e.message || "Could not add member");
    }
  }

  async function removeMember(userId: number) {
    try {
      const conv = await api.removeMember(conversation.id, userId);
      upsertConversation(conv);
    } catch (e: any) {
      pushToast(e.message || "Could not remove member");
    }
  }

  async function leaveGroup() {
    try {
      await api.removeMember(conversation.id, me.id);
      await loadConversations();
      setActiveConv(null);
      onClose();
    } catch {
      pushToast("Could not leave group");
    }
  }

  const title = conversationTitle(conversation, me.id);
  const other = otherMember(conversation, me.id);

  return (
    <Modal open={open} onClose={onClose} title={isGroup ? "Group info" : "Contact info"}>
      <div className="mb-4 flex flex-col items-center text-center">
        <Avatar
          name={title}
          src={conversation.avatar_url || other?.avatar_url}
          seed={isGroup ? conversation.id + 1000 : other?.id}
          size={80}
        />
        <h3 className="mt-3 text-xl font-semibold text-txt">{title}</h3>
        {isGroup ? (
          <p className="text-sm text-muted">
            {conversation.members.length} members
          </p>
        ) : (
          other && (
            <p className="text-sm text-muted">
              {isOnline(other.id) ? "online" : lastSeenText(lastSeen(other.id))}
            </p>
          )
        )}
        {!isGroup && other?.about && (
          <p className="mt-1 text-sm text-muted">{other.about}</p>
        )}
        {!isGroup && other && (
          <p className="mt-1 text-sm text-muted">{other.phone}</p>
        )}
      </div>

      {isGroup && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-muted">Members</span>
            {amAdmin && (
              <button
                onClick={() => setAdding((v) => !v)}
                className="flex items-center gap-1 text-sm text-signal-blue hover:underline"
              >
                <UserPlus size={16} /> Add
              </button>
            )}
          </div>

          {adding && (
            <div className="mb-3">
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2">
                <Search size={16} className="text-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search people to add"
                  className="w-full bg-transparent text-sm text-txt outline-none placeholder:text-muted"
                />
              </div>
              {results.map((u) => (
                <button
                  key={u.id}
                  onClick={() => addMember(u)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface2"
                >
                  <Avatar name={u.display_name} src={u.avatar_url} seed={u.id} size={32} />
                  <span className="text-sm text-txt">{u.display_name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="max-h-56 overflow-y-auto">
            {conversation.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface2"
              >
                <Avatar
                  name={m.user.display_name}
                  src={m.user.avatar_url}
                  seed={m.user.id}
                  size={36}
                  online={isOnline(m.user.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-txt">
                      {m.user.id === me.id ? "You" : m.user.display_name}
                    </span>
                    {m.role === "admin" && (
                      <Crown size={13} className="text-amber-500" />
                    )}
                  </div>
                </div>
                {amAdmin && m.user.id !== me.id && (
                  <button
                    onClick={() => removeMember(m.user.id)}
                    title="Remove"
                    className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-red-500"
                  >
                    <UserMinus size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={leaveGroup}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10"
          >
            <LogOut size={16} /> Leave group
          </button>
        </>
      )}
    </Modal>
  );
}
