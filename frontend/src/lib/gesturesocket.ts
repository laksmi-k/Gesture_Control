import { useCallback, useEffect, useRef } from "react";

const SOCKET_URL = "ws://localhost:8765";
const MAX_QUEUE_SIZE = 25;

class ReconnectingGestureSocket {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectDelay = 1000;
  private disposed = false;
  private readonly pendingActions: string[] = [];

  connect() {
    if (this.disposed || this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;
    try {
      const socket = new WebSocket(SOCKET_URL);
      this.socket = socket;
      socket.onopen = () => {
        this.reconnectDelay = 1000;
        while (this.pendingActions.length > 0 && socket.readyState === WebSocket.OPEN) {
          socket.send(this.pendingActions.shift() ?? "");
        }
      };
      socket.onclose = () => {
        if (this.socket === socket) this.socket = null;
        this.scheduleReconnect();
      };
      socket.onerror = () => {
        // onclose schedules the retry; keep a missing local controller silent in the UI.
        socket.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  send(actionName: string) {
    if (this.disposed) return;
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(actionName);
      return;
    }
    if (this.pendingActions.length >= MAX_QUEUE_SIZE) this.pendingActions.shift();
    this.pendingActions.push(actionName);
    this.connect();
  }

  dispose() {
    this.disposed = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.pendingActions.length = 0;
    this.socket?.close();
    this.socket = null;
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000);
    }, this.reconnectDelay);
  }
}

export function useGestureSocket() {
  const clientRef = useRef<ReconnectingGestureSocket | null>(null);

  useEffect(() => {
    const client = new ReconnectingGestureSocket();
    clientRef.current = client;
    client.connect();
    return () => {
      client.dispose();
      clientRef.current = null;
    };
  }, []);

  const sendAction = useCallback((actionName: string) => {
    clientRef.current?.send(actionName);
  }, []);

  return { sendAction };
}