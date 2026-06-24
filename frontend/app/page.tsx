"use client";
import ChatPane from "@/components/chat/ChatPane";
import Sidebar from "@/components/conversation/Sidebar";
import Toasts from "@/components/ui/Toasts";
import { ApiError, clearToken, getToken } from "@/lib/api";
import { useStore } from "@/lib/store";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [connError, setConnError] = useState(false);
  const currentUser = useStore((s) => s.currentUser);
  const activeConvId = useStore((s) => s.activeConvId);
  const bootstrap = useStore((s) => s.bootstrap);

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
    </main>
  );
}
