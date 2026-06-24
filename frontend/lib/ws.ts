import { getToken } from "./api";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export type WsEvent = { type: string; payload: any };
type Handler = (event: WsEvent) => void;

/**
 * Singleton WebSocket client with auto-reconnect and a simple pub/sub.
 * Components subscribe via `wsClient.on(handler)`; the store dispatches events.
 */
class WsClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private shouldRun = false;
  private connectedHandlers = new Set<(connected: boolean) => void>();

  connect() {
    this.shouldRun = true;
    this.open();
  }

  private open() {
    const token = getToken();
    if (!token) return;
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;

    this.ws = new WebSocket(`${WS_URL}/ws?token=${token}`);

    this.ws.onopen = () => {
      this.connectedHandlers.forEach((h) => h(true));
      this.startHeartbeat();
    };

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as WsEvent;
        this.handlers.forEach((h) => h(data));
      } catch {
        /* ignore malformed */
      }
    };

    this.ws.onclose = () => {
      this.connectedHandlers.forEach((h) => h(false));
      this.stopHeartbeat();
      if (this.shouldRun) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  // Periodic ping keeps the socket alive through idle proxies (e.g. Render)
  // and lets the server detect dead connections promptly for accurate presence.
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(
      () => this.send({ type: "ping", payload: {} }),
      25000
    );
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, 1500);
  }

  send(event: WsEvent) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  on(handler: Handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onConnectionChange(handler: (connected: boolean) => void) {
    this.connectedHandlers.add(handler);
    return () => this.connectedHandlers.delete(handler);
  }

  disconnect() {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.ws?.close();
    this.ws = null;
  }
}

export const wsClient = new WsClient();
