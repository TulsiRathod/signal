"use client";
import { useStore } from "@/lib/store";
import type { Conversation, Message } from "@/lib/types";
import { daySeparator, sameDay } from "@/lib/utils";
import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

interface Props {
  conversation: Conversation;
  onReply: (m: Message) => void;
}

export default function MessageList({ conversation, onReply }: Props) {
  const me = useStore((s) => s.currentUser)!;
  const messages = useStore((s) => s.messages[conversation.id]) || [];
  const typing = useStore((s) => s.typing[conversation.id]) || [];
  const bottomRef = useRef<HTMLDivElement>(null);

  const typingNames = typing
    .map(
      (uid) =>
        conversation.members.find((m) => m.user.id === uid)?.user.display_name
    )
    .filter(Boolean) as string[];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typingNames.length]);

  return (
    <div className="scroll-thin flex-1 space-y-1 overflow-y-auto px-4 py-4">
      {/* Encryption notice (simulated) */}
      <div className="mx-auto mb-3 max-w-md rounded-lg bg-surface2 px-3 py-2 text-center text-xs text-muted">
        🔒 Messages are end-to-end encrypted (simulated). No one outside this
        chat can read them.
      </div>

      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const isOwn = m.sender_id === me.id;
        const newDay = !prev || !sameDay(prev.created_at, m.created_at);
        const startGroup =
          newDay || !prev || prev.sender_id !== m.sender_id || prev.type === "system";

        if (m.type === "system") {
          return (
            <div key={m.id}>
              {newDay && <DayLabel iso={m.created_at} />}
              <div className="my-2 text-center text-xs text-muted">
                {m.content}
              </div>
            </div>
          );
        }

        return (
          <div key={m._localId || m.id} className={startGroup ? "mt-3" : ""}>
            {newDay && <DayLabel iso={m.created_at} />}
            <MessageBubble
              message={m}
              conversation={conversation}
              isOwn={isOwn}
              showName={startGroup}
              showAvatar={startGroup}
              onReply={onReply}
            />
          </div>
        );
      })}

      {typingNames.length > 0 && (
        <div className="mt-3 flex items-end gap-2">
          <TypingIndicator />
          {conversation.type === "group" && (
            <span className="text-xs text-muted">
              {typingNames.join(", ")} {typingNames.length > 1 ? "are" : "is"}{" "}
              typing…
            </span>
          )}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function DayLabel({ iso }: { iso: string }) {
  return (
    <div className="my-3 flex justify-center">
      <span className="rounded-full bg-surface2 px-3 py-1 text-xs text-muted">
        {daySeparator(iso)}
      </span>
    </div>
  );
}
