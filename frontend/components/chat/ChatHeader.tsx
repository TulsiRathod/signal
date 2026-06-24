"use client";
import Avatar from "@/components/ui/Avatar";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Conversation } from "@/lib/types";
import { conversationTitle, disappearLabel, lastSeenText, otherMember } from "@/lib/utils";
import { ArrowLeft, MoreVertical, Phone, Timer, Video } from "lucide-react";
import { useState } from "react";

interface Props {
  conversation: Conversation;
  onOpenInfo: () => void;
  onComingSoon: (feature: string) => void;
}

const DISAPPEAR_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: "Off", seconds: null },
  { label: "30 seconds", seconds: 30 },
  { label: "5 minutes", seconds: 300 },
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86400 },
];

export default function ChatHeader({
  conversation,
  onOpenInfo,
  onComingSoon,
}: Props) {
  const me = useStore((s) => s.currentUser)!;
  const setActiveConv = useStore((s) => s.setActiveConv);
  const upsertConversation = useStore((s) => s.upsertConversation);
  const pushToast = useStore((s) => s.pushToast);
  const typing = useStore((s) => s.typing[conversation.id]) || [];
  const [menuOpen, setMenuOpen] = useState(false);

  const title = conversationTitle(conversation, me.id);
  const other = otherMember(conversation, me.id);
  // Subscribe to the presence value itself so the header updates in real time.
  const presence = useStore((s) => (other ? s.presence[other.id] : undefined));
  const online = !!presence?.is_online;

  async function chooseDisappearing(seconds: number | null) {
    setMenuOpen(false);
    try {
      const conv = await api.setDisappearing(conversation.id, seconds);
      upsertConversation(conv);
    } catch {
      pushToast("Could not update disappearing messages");
    }
  }

  let subtitle = "";
  if (typing.length > 0) {
    subtitle = "typing…";
  } else if (conversation.type === "group") {
    subtitle = `${conversation.members.length} members`;
  } else if (other) {
    subtitle = online ? "online" : lastSeenText(presence?.last_seen ?? null);
  }

  return (
    <header className="flex items-center gap-3 border-b border-border bg-surface px-3 py-2.5">
      <button
        onClick={() => setActiveConv(null)}
        className="rounded-full p-1.5 text-muted hover:bg-surface2 md:hidden"
      >
        <ArrowLeft size={20} />
      </button>

      <button
        onClick={onOpenInfo}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Avatar
          name={title}
          src={conversation.avatar_url || other?.avatar_url}
          seed={conversation.type === "group" ? conversation.id + 1000 : other?.id}
          size={40}
          online={conversation.type === "direct" && other ? online : undefined}
        />
        <div className="min-w-0">
          <div className="truncate font-semibold text-txt">{title}</div>
          <div className="truncate text-xs text-muted">
            {subtitle === "typing…" ? (
              <span className="text-signal-blue">{subtitle}</span>
            ) : (
              subtitle
            )}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1 text-muted">
        {conversation.disappear_seconds ? (
          <span
            title={`Disappearing messages: ${disappearLabel(
              conversation.disappear_seconds
            )}`}
            className="flex items-center gap-1 rounded-full bg-signal-blue/10 px-2 py-1 text-xs text-signal-blue"
          >
            <Timer size={14} />
            {disappearLabel(conversation.disappear_seconds)}
          </span>
        ) : null}
        <button
          title="Voice call"
          onClick={() => onComingSoon("Voice calls")}
          className="rounded-full p-2 hover:bg-surface2 hover:text-txt"
        >
          <Phone size={20} />
        </button>
        <button
          title="Video call"
          onClick={() => onComingSoon("Video calls")}
          className="rounded-full p-2 hover:bg-surface2 hover:text-txt"
        >
          <Video size={20} />
        </button>
        <div className="relative">
          <button
            title="More"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-full p-2 hover:bg-surface2 hover:text-txt"
          >
            <MoreVertical size={20} />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-1 w-52 animate-fade-in overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted">
                  <Timer size={14} /> Disappearing messages
                </div>
                {DISAPPEAR_OPTIONS.map((opt) => {
                  const active =
                    (conversation.disappear_seconds || null) === opt.seconds;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => chooseDisappearing(opt.seconds)}
                      className={
                        "flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-surface2 " +
                        (active ? "text-signal-blue" : "text-txt")
                      }
                    >
                      {opt.label}
                      {active && <span>✓</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
