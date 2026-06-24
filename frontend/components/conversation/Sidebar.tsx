"use client";
import NewChatModal from "@/components/modals/NewChatModal";
import NewGroupModal from "@/components/modals/NewGroupModal";
import SettingsModal from "@/components/modals/SettingsModal";
import Avatar from "@/components/ui/Avatar";
import { useStore } from "@/lib/store";
import { conversationTitle } from "@/lib/utils";
import { Menu, PenSquare, Search, Settings, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import ConversationItem from "./ConversationItem";

export default function Sidebar() {
  const me = useStore((s) => s.currentUser)!;
  const conversations = useStore((s) => s.conversations);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const title = conversationTitle(c, me.id).toLowerCase();
      const lastMsg = c.last_message?.content?.toLowerCase() || "";
      const memberMatch = c.members.some((m) =>
        m.user.display_name.toLowerCase().includes(q)
      );
      return title.includes(q) || lastMsg.includes(q) || memberMatch;
    });
  }, [conversations, query, me.id]);

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={me.display_name} src={me.avatar_url} seed={me.id} size={36} />
          <span className="font-semibold text-txt">{me.display_name}</span>
        </div>
        <div className="flex items-center gap-1 text-muted">
          <button
            title="New chat"
            onClick={() => setShowNewChat(true)}
            className="rounded-full p-2 hover:bg-surface2 hover:text-txt"
          >
            <PenSquare size={20} />
          </button>
          <button
            title="New group"
            onClick={() => setShowNewGroup(true)}
            className="rounded-full p-2 hover:bg-surface2 hover:text-txt"
          >
            <Users size={20} />
          </button>
          <div className="relative">
            <button
              title="Menu"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full p-2 hover:bg-surface2 hover:text-txt"
            >
              <Menu size={20} />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-1 w-44 animate-fade-in overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
                  <button
                    onClick={() => {
                      setShowSettings(true);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-txt hover:bg-surface2"
                  >
                    <Settings size={16} /> Settings
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2">
          <Search size={18} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-sm text-txt outline-none placeholder:text-muted"
          />
          {query && (
            <button onClick={() => setQuery("")}>
              <X size={16} className="text-muted hover:text-txt" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="scroll-thin flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            {query ? "No results" : "No conversations yet"}
          </p>
        ) : (
          filtered.map((c) => <ConversationItem key={c.id} conversation={c} />)
        )}
      </div>

      <NewChatModal open={showNewChat} onClose={() => setShowNewChat(false)} />
      <NewGroupModal open={showNewGroup} onClose={() => setShowNewGroup(false)} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
