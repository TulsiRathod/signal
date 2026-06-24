"use client";
import { mediaUrl } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Conversation, Message } from "@/lib/types";
import { avatarColor, bubbleTime } from "@/lib/utils";
import clsx from "clsx";
import { Reply, Smile, Trash2 } from "lucide-react";
import { useState } from "react";
import Avatar from "../ui/Avatar";
import Checks from "./Checks";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface Props {
  message: Message;
  conversation: Conversation;
  isOwn: boolean;
  showName: boolean;
  showAvatar: boolean;
  onReply: (m: Message) => void;
}

export default function MessageBubble({
  message,
  conversation,
  isOwn,
  showName,
  showAvatar,
  onReply,
}: Props) {
  const me = useStore((s) => s.currentUser)!;
  const toggleReaction = useStore((s) => s.toggleReaction);
  const deleteMessage = useStore((s) => s.deleteMessage);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sender = conversation.members.find((m) => m.user.id === message.sender_id);
  const senderName = sender?.user.display_name || "Unknown";
  const isGroup = conversation.type === "group";

  // Aggregate reactions by emoji.
  const grouped = message.reactions.reduce<Record<string, number[]>>((acc, r) => {
    (acc[r.emoji] ||= []).push(r.user_id);
    return acc;
  }, {});

  const replyTo = message.reply_to;
  const replyName = replyTo
    ? conversation.members.find((m) => m.user.id === replyTo.sender_id)?.user
        .display_name || "Unknown"
    : "";

  return (
    <div
      className={clsx(
        "group flex items-end gap-2 px-1",
        isOwn ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar slot (received group messages) */}
      {isGroup && !isOwn ? (
        showAvatar ? (
          <Avatar name={senderName} src={sender?.user.avatar_url} seed={message.sender_id} size={28} />
        ) : (
          <div className="w-7 shrink-0" />
        )
      ) : null}

      <div className={clsx("relative max-w-[75%]", isOwn && "items-end")}>
        {/* Bubble */}
        <div
          className={clsx(
            "relative rounded-2xl px-3 py-2 text-[15px] shadow-sm",
            isOwn
              ? "rounded-br-md bg-signal-blue text-white"
              : "rounded-bl-md bg-bubbleIn text-txt"
          )}
        >
          {isGroup && !isOwn && showName && (
            <div
              className="mb-0.5 text-xs font-semibold"
              style={{ color: avatarColor(message.sender_id) }}
            >
              {senderName}
            </div>
          )}

          {replyTo && (
            <div
              className={clsx(
                "mb-1 border-l-2 pl-2 text-xs",
                isOwn ? "border-white/60" : "border-signal-blue"
              )}
            >
              <div className="font-medium opacity-90">{replyName}</div>
              <div className="truncate opacity-75">
                {replyTo.type === "image" ? "📷 Photo" : replyTo.content}
              </div>
            </div>
          )}

          {message.is_deleted ? (
            <span className="italic opacity-70">This message was deleted</span>
          ) : (
            <>
              {message.attachments.map((a) =>
                a.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={a.id}
                    src={mediaUrl(a.url)}
                    alt={a.filename || "image"}
                    className="mb-1 max-h-72 rounded-lg object-cover"
                  />
                ) : (
                  <a
                    key={a.id}
                    href={mediaUrl(a.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-1 block underline"
                  >
                    📎 {a.filename || "Attachment"}
                  </a>
                )
              )}
              {message.content && (
                <span className="whitespace-pre-wrap break-words">
                  {message.content}
                </span>
              )}
            </>
          )}

          {/* Time + checks */}
          <div
            className={clsx(
              "mt-0.5 flex items-center justify-end gap-1 text-[11px]",
              isOwn ? "text-white/80" : "text-muted"
            )}
          >
            <span>{bubbleTime(message.created_at)}</span>
            {isOwn && !message.is_deleted && <Checks status={message.status} />}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(grouped).length > 0 && (
          <div
            className={clsx(
              "-mt-1 flex flex-wrap gap-1",
              isOwn ? "justify-end" : "justify-start"
            )}
          >
            {Object.entries(grouped).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => toggleReaction(message.id, emoji)}
                className={clsx(
                  "flex items-center gap-0.5 rounded-full border border-border bg-surface px-1.5 py-0.5 text-xs",
                  users.includes(me.id) && "ring-1 ring-signal-blue"
                )}
              >
                <span>{emoji}</span>
                <span className="text-muted">{users.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {!message.is_deleted && (
        <div
          className={clsx(
            "relative flex items-center gap-0.5 self-center opacity-0 transition group-hover:opacity-100",
            isOwn ? "flex-row-reverse" : "flex-row"
          )}
        >
          <button
            title="React"
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-full p-1.5 text-muted hover:bg-surface2 hover:text-txt"
          >
            <Smile size={16} />
          </button>
          <button
            title="Reply"
            onClick={() => onReply(message)}
            className="rounded-full p-1.5 text-muted hover:bg-surface2 hover:text-txt"
          >
            <Reply size={16} />
          </button>
          {isOwn && (
            <button
              title="Delete"
              onClick={() => deleteMessage(message.id)}
              className="rounded-full p-1.5 text-muted hover:bg-surface2 hover:text-red-500"
            >
              <Trash2 size={16} />
            </button>
          )}

          {pickerOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setPickerOpen(false)}
              />
              <div className="absolute bottom-8 z-20 flex animate-fade-in gap-1 rounded-full border border-border bg-surface px-2 py-1 shadow-lg">
                {QUICK_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      toggleReaction(message.id, e);
                      setPickerOpen(false);
                    }}
                    className="rounded-full p-1 text-lg hover:bg-surface2"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
