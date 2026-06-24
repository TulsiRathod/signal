"use client";
import Avatar from "@/components/ui/Avatar";
import { useStore } from "@/lib/store";
import type { Conversation } from "@/lib/types";
import { conversationTitle, listTime, otherMember } from "@/lib/utils";
import clsx from "clsx";

export default function ConversationItem({
  conversation,
}: {
  conversation: Conversation;
}) {
  const me = useStore((s) => s.currentUser)!;
  const activeConvId = useStore((s) => s.activeConvId);
  const setActiveConv = useStore((s) => s.setActiveConv);
  const isOnline = useStore((s) => s.isOnline);
  const typing = useStore((s) => s.typing[conversation.id]);

  const title = conversationTitle(conversation, me.id);
  const other = otherMember(conversation, me.id);
  const active = activeConvId === conversation.id;
  const unread = conversation.unread_count;

  const last = conversation.last_message;
  const someoneTyping = typing && typing.length > 0;

  let preview = "No messages yet";
  if (someoneTyping) {
    preview = "typing…";
  } else if (last) {
    if (last.type === "system") preview = last.content;
    else if (last.type === "image") preview = "📷 Photo";
    else if (last.type === "file") preview = "📎 Attachment";
    else if (last.is_deleted) preview = "This message was deleted";
    else {
      const prefix =
        last.sender_id === me.id
          ? "You: "
          : conversation.type === "group"
          ? `${
              conversation.members.find((m) => m.user.id === last.sender_id)
                ?.user.display_name.split(" ")[0] || ""
            }: `
          : "";
      preview = prefix + last.content;
    }
  }

  return (
    <button
      onClick={() => setActiveConv(conversation.id)}
      className={clsx(
        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
        active ? "bg-signal-blue/10" : "hover:bg-surface2"
      )}
    >
      <Avatar
        name={title}
        src={conversation.avatar_url || other?.avatar_url}
        seed={conversation.type === "group" ? conversation.id + 1000 : other?.id}
        size={48}
        online={
          conversation.type === "direct" && other ? isOnline(other.id) : undefined
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-txt">{title}</span>
          {last && (
            <span
              className={clsx(
                "shrink-0 text-xs",
                unread > 0 ? "text-signal-blue" : "text-muted"
              )}
            >
              {listTime(conversation.updated_at)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={clsx(
              "truncate text-sm",
              someoneTyping ? "text-signal-blue" : "text-muted"
            )}
          >
            {preview}
          </span>
          {unread > 0 && (
            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-signal-blue px-1.5 text-xs font-medium text-white">
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
