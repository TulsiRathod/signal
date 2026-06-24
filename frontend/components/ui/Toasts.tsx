"use client";
import { useStore } from "@/lib/store";

export default function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="pointer-events-auto max-w-sm cursor-pointer animate-slide-up rounded-xl bg-neutral-900/95 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-neutral-700"
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
