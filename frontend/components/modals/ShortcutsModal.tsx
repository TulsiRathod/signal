"use client";
import Modal from "@/components/ui/Modal";

const MOD = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)
  ? "⌘"
  : "Ctrl";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: [MOD, "K"], label: "Search / start a new chat" },
  { keys: [MOD, "Shift", "L"], label: "Toggle dark mode" },
  { keys: ["Alt", "↑"], label: "Previous conversation" },
  { keys: ["Alt", "↓"], label: "Next conversation" },
  { keys: ["Enter"], label: "Send message" },
  { keys: ["Shift", "Enter"], label: "New line in message" },
  { keys: ["Esc"], label: "Close dialog" },
  { keys: ["?"], label: "Show this help" },
];

export default function ShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts">
      <div className="space-y-1">
        {SHORTCUTS.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between py-1.5 text-sm"
          >
            <span className="text-txt">{s.label}</span>
            <span className="flex gap-1">
              {s.keys.map((k) => (
                <kbd
                  key={k}
                  className="rounded-md border border-border bg-surface2 px-2 py-0.5 text-xs font-medium text-muted"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
