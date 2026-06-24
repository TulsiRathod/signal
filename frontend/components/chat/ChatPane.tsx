"use client";
import GroupInfoModal from "@/components/modals/GroupInfoModal";
import { useStore } from "@/lib/store";
import type { Message } from "@/lib/types";
import { Lock, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageList from "./MessageList";

export default function ChatPane() {
  const activeConvId = useStore((s) => s.activeConvId);
  const conversation = useStore((s) =>
    s.conversations.find((c) => c.id === s.activeConvId)
  );
  const pushToast = useStore((s) => s.pushToast);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // Reset reply target when switching conversations.
  useEffect(() => {
    setReplyTo(null);
    setShowInfo(false);
  }, [activeConvId]);

  if (!conversation) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-bg text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-surface2 text-muted">
          <MessageSquare size={36} />
        </div>
        <h2 className="text-lg font-medium text-txt">Signal</h2>
        <p className="mt-1 max-w-xs text-sm text-muted">
          Select a conversation to start messaging.
        </p>
        <p className="mt-6 flex items-center gap-1.5 text-xs text-muted">
          <Lock size={12} /> Your messages are end-to-end encrypted (simulated)
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <ChatHeader
        conversation={conversation}
        onOpenInfo={() => setShowInfo(true)}
        onComingSoon={(f) => pushToast(`${f} — coming soon`)}
      />
      <MessageList conversation={conversation} onReply={setReplyTo} />
      <MessageInput
        conversation={conversation}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
      />
      <GroupInfoModal
        open={showInfo}
        onClose={() => setShowInfo(false)}
        conversation={conversation}
      />
    </div>
  );
}
