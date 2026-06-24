"use client";
import ChatPane from "@/components/chat/ChatPane";
import Sidebar from "@/components/conversation/Sidebar";
import ShortcutsModal from "@/components/modals/ShortcutsModal";
import Toasts from "@/components/ui/Toasts";
import { ApiError, clearToken, getToken } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();
  const { toggle: toggleTheme } = useTheme();
  const [ready, setReady] = useState(false);
  const [connError, setConnError] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const currentUser = useStore((s) => s.currentUser);
  const activeConvId = useStore((s) => s.activeConvId);
  const bootstrap = useStore((s) => s.bootstrap);

  // Global keyboard shortcuts.
  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      return (
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      );
    };
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        window.dispatchEvent(new Event("signal:focus-search"));
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggleTheme();
      } else if (!isTyping(e.target) && e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      } else if (
        !isTyping(e.target) &&
        e.altKey &&
        (e.key === "ArrowDown" || e.key === "ArrowUp")
      ) {
        e.preventDefault();
        const { conversations, activeConvId: cur, setActiveConv } =
          useStore.getState();
        if (!conversations.length) return;
        const idx = conversations.findIndex((c) => c.id === cur);
        let next = idx === -1 ? 0 : e.key === "ArrowDown" ? idx + 1 : idx - 1;
        next = Math.max(0, Math.min(conversations.length - 1, next));
        setActiveConv(conversations[next].id);
      }
    };
    const showHelp = () => setHelpOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("signal:show-shortcuts", showHelp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("signal:show-shortcuts", showHelp);
    };
  }, [toggleTheme]);

  function start() {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setConnError(false);
    bootstrap()
      .then(() => setReady(true))
      .catch((e) => {
        // Only a real auth failure should end the session. Transient errors
        // (e.g. backend waking from sleep, network blip) keep the token and
        // let the user retry — so a page refresh never silently logs you out.
        if (e instanceof ApiError && e.status === 401) {
          clearToken();
          router.replace("/login");
        } else {
          setConnError(true);
        }
      });
  }

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (connError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
        <p className="text-txt">Couldn&apos;t reach the server.</p>
        <p className="max-w-xs text-sm text-muted">
          The backend may be waking up (free hosting sleeps when idle). Your
          session is still saved — just retry.
        </p>
        <button
          onClick={start}
          className="rounded-lg bg-signal-blue px-5 py-2 font-medium text-white hover:bg-signal-bluedark"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!ready || !currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-signal-blue border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="flex h-screen overflow-hidden bg-bg">
      {/* Sidebar: full width on mobile, fixed pane on desktop */}
      <div
        className={clsx(
          "w-full shrink-0 border-r border-border md:w-[380px]",
          activeConvId != null ? "hidden md:block" : "block"
        )}
      >
        <Sidebar />
      </div>

      {/* Chat pane */}
      <div
        className={clsx(
          "flex-1",
          activeConvId == null ? "hidden md:block" : "block"
        )}
      >
        <ChatPane />
      </div>

      <Toasts />
      <ShortcutsModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </main>
  );
}
