"use client";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { User } from "@/lib/types";
import { Check, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function NewGroupModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);

  const setActiveConv = useStore((s) => s.setActiveConv);
  const upsertConversation = useStore((s) => s.upsertConversation);
  const pushToast = useStore((s) => s.pushToast);

  useEffect(() => {
    if (!open) {
      setName("");
      setQuery("");
      setResults([]);
      setSelected([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) return setResults([]);
    const t = setTimeout(async () => {
      try {
        setResults(await api.searchUsers(q));
      } catch {
        /* ignore */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  function toggle(user: User) {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  }

  async function create() {
    if (!name.trim()) return pushToast("Enter a group name");
    if (selected.length === 0) return pushToast("Add at least one member");
    setCreating(true);
    try {
      const conv = await api.createConversation({
        type: "group",
        name: name.trim(),
        member_ids: selected.map((u) => u.id),
      });
      upsertConversation(conv);
      await setActiveConv(conv.id);
      onClose();
    } catch {
      pushToast("Could not create group");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New group"
      footer={
        <>
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-surface2"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={creating}
            className="rounded-lg bg-signal-blue px-4 py-2 text-sm font-medium text-white hover:bg-signal-bluedark disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create group"}
          </button>
        </>
      }
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Group name"
        className="mb-3 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-txt outline-none focus:border-signal-blue"
      />

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((u) => (
            <span
              key={u.id}
              className="flex items-center gap-1 rounded-full bg-signal-blue/10 py-1 pl-1 pr-2 text-sm text-signal-blue"
            >
              <Avatar name={u.display_name} src={u.avatar_url} seed={u.id} size={22} />
              {u.display_name.split(" ")[0]}
              <button onClick={() => toggle(u)}>
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mb-2 flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2">
        <Search size={18} className="text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add members"
          className="w-full bg-transparent text-sm text-txt outline-none placeholder:text-muted"
        />
      </div>

      <div className="max-h-60 overflow-y-auto">
        {results.map((u) => {
          const checked = selected.some((s) => s.id === u.id);
          return (
            <button
              key={u.id}
              onClick={() => toggle(u)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface2"
            >
              <Avatar name={u.display_name} src={u.avatar_url} seed={u.id} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-txt">
                  {u.display_name}
                </div>
                <div className="truncate text-sm text-muted">
                  {u.username ? `@${u.username}` : u.phone}
                </div>
              </div>
              <span
                className={
                  checked
                    ? "flex h-5 w-5 items-center justify-center rounded-full bg-signal-blue text-white"
                    : "h-5 w-5 rounded-full border border-border"
                }
              >
                {checked && <Check size={14} />}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
