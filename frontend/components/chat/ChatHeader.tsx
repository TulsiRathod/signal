"use client";
import Avatar from "@/components/ui/Avatar";
import { useStore } from "@/lib/store";
import type { Conversation } from "@/lib/types";
import { conversationTitle, lastSeenText, otherMember } from "@/lib/utils";
import { ArrowLeft, Phone, Video } from "lucide-react";

interface Props {
  conversation: Conversation;
  onOpenInfo: () => void;
  onComingSoon: (feature: string) => void;
}

export default function ChatHeader({
  conversation,
  onOpenInfo,
  onComingSoon,
}: Props) {
  const me = useStore((s) => s.currentUser)!;
  const setActiveConv = useStore((s) => s.setActiveConv);
  const isOnline = useStore((s) => s.isOnline);
  const lastSeen = useStore((s) => s.lastSeen);
  const typing = useStore((s) => s.typing[conversation.id]) || [];

  const title = conversationTitle(conversation, me.id);
  const other = otherMember(conversation, me.id);

  let subtitle = "";
  if (typing.length > 0) {
    subtitle = "typing…";
  } else if (conversation.type === "group") {
    subtitle = `${conversation.members.length} members`;
  } else if (other) {
    subtitle = isOnline(other.id) ? "online" : lastSeenText(lastSeen(other.id));
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
          online={conversation.type === "direct" && other ? isOnline(other.id) : undefined}
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
      </div>
    </header>
  );
}
