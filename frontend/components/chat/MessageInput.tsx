"use client";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Conversation, Message } from "@/lib/types";
import { Paperclip, Send, Smile, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const EMOJIS = [
  "😀", "😂", "🥰", "😎", "🤔", "😢", "😡", "👍", "👎", "🙏",
  "❤️", "🔥", "🎉", "✨", "💯", "👏", "🙌", "😴", "🤝", "☕",
  "🍕", "🏔️", "✈️", "📷", "🎵", "⚡", "🌟", "💪", "👀", "🚀",
];

interface Props {
  conversation: Conversation;
  replyTo: Message | null;
  onClearReply: () => void;
}

export default function MessageInput({
  conversation,
  replyTo,
  onClearReply,
}: Props) {
  const me = useStore((s) => s.currentUser)!;
  const sendMessage = useStore((s) => s.sendMessage);
  const sendTyping = useStore((s) => s.sendTyping);
  const pushToast = useStore((s) => s.pushToast);

  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);

  // Stop typing when switching conversations.
  useEffect(() => {
    return () => {
      if (isTyping.current) {
        sendTyping(false);
        isTyping.current = false;
      }
    };
  }, [conversation.id, sendTyping]);

  function handleChange(v: string) {
    setText(v);
    if (!isTyping.current) {
      sendTyping(true);
      isTyping.current = true;
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      sendTyping(false);
      isTyping.current = false;
    }, 1500);
  }

  async function handleSend() {
    const content = text.trim();
    if (!content) return;
    setText("");
    setShowEmoji(false);
    if (isTyping.current) {
      sendTyping(false);
      isTyping.current = false;
    }
    await sendMessage({
      content,
      type: "text",
      reply_to_id: replyTo?.id ?? null,
    });
    onClearReply();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadAttachment(file);
      await sendMessage({
        content: text.trim(),
        type: res.type,
        reply_to_id: replyTo?.id ?? null,
        attachments: [
          { url: res.url, type: res.type, filename: res.filename, size: res.size },
        ],
      });
      setText("");
      onClearReply();
    } catch {
      pushToast("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const replyName = replyTo
    ? conversation.members.find((m) => m.user.id === replyTo.sender_id)?.user
        .display_name || "Unknown"
    : "";

  return (
    <div className="border-t border-border bg-surface px-3 py-2.5">
      {replyTo && (
        <div className="mb-2 flex items-center justify-between rounded-lg border-l-2 border-signal-blue bg-surface2 px-3 py-1.5">
          <div className="min-w-0">
            <div className="text-xs font-medium text-signal-blue">
              Replying to {replyTo.sender_id === me.id ? "yourself" : replyName}
            </div>
            <div className="truncate text-sm text-muted">
              {replyTo.type === "image" ? "📷 Photo" : replyTo.content}
            </div>
          </div>
          <button onClick={onClearReply} className="text-muted hover:text-txt">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="relative flex items-end gap-2">
        <button
          onClick={() => setShowEmoji((v) => !v)}
          className="rounded-full p-2 text-muted hover:bg-surface2 hover:text-txt"
        >
          <Smile size={22} />
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-full p-2 text-muted hover:bg-surface2 hover:text-txt disabled:opacity-50"
        >
          <Paperclip size={22} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={handleFile}
        />

        <textarea
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          placeholder={uploading ? "Uploading…" : "Message"}
          className="scroll-thin max-h-32 flex-1 resize-none rounded-2xl bg-surface2 px-4 py-2.5 text-[15px] text-txt outline-none placeholder:text-muted"
        />

        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="rounded-full bg-signal-blue p-2.5 text-white transition hover:bg-signal-bluedark disabled:opacity-40"
        >
          <Send size={20} />
        </button>

        {showEmoji && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowEmoji(false)}
            />
            <div className="absolute bottom-14 left-0 z-20 grid w-72 animate-fade-in grid-cols-8 gap-1 rounded-xl border border-border bg-surface p-2 shadow-lg">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => handleChange(text + e)}
                  className="rounded-lg p-1 text-xl hover:bg-surface2"
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
