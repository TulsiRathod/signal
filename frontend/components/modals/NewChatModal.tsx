"use client";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { User } from "@/lib/types";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

export default function NewChatModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const setActiveConv = useStore((s) => s.setActiveConv);
  const upsertConversation = useStore((s) => s.upsertConversation);
  const pushToast = useStore((s) => s.pushToast);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        setResults(await api.searchUsers(q));
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  async function startChat(user: User) {
    try {
      const conv = await api.createConversation({
        type: "direct",
        member_ids: [user.id],
      });
      upsertConversation(conv);
      await setActiveConv(conv.id);
      onClose();
    } catch {
      pushToast("Could not start chat");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New chat">
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2">
        <Search size={18} className="text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, @username or phone"
          className="w-full bg-transparent text-sm text-txt outline-none placeholder:text-muted"
        />
      </div>

      <div className="max-h-80 overflow-y-auto">
        {loading && <p className="py-4 text-center text-sm text-muted">Searching…</p>}
        {!loading && query && results.length === 0 && (
          <p className="py-4 text-center text-sm text-muted">No users found</p>
        )}
        {!query && (
          <p className="py-4 text-center text-sm text-muted">
            Search for people to start a conversation
          </p>
        )}
        {results.map((u) => (
          <button
            key={u.id}
            onClick={() => startChat(u)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface2"
          >
            <Avatar name={u.display_name} src={u.avatar_url} seed={u.id} size={40} />
            <div className="min-w-0">
              <div className="truncate font-medium text-txt">{u.display_name}</div>
              <div className="truncate text-sm text-muted">
                {u.username ? `@${u.username}` : u.phone}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
