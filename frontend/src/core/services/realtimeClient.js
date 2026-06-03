import { io } from "socket.io-client";
import { API_ROUTES } from "@/core/config/apiConfig.js";

// Cliente de tiempo real basado en Socket.IO. Reemplaza al consumo (inexistente)
// de EMQX: se conecta al mismo backend HTTP reutilizando el JWT que guarda el
// httpClient en localStorage('token'). Singleton compartido por toda la app.

const readToken = () =>
  (typeof window !== "undefined" && window.localStorage.getItem("token")) || "";

// Resuelve a qué origen conectar y con qué path de handshake, según cómo esté
// configurada la API:
//  - BASE relativa (p. ej. "/api", detrás del proxy nginx): se conecta al mismo
//    origen y el handshake va por "{BASE}/socket.io" para que nginx lo enrute al
//    backend (la location /api/ ya reenvía con upgrade de WebSocket y le quita el
//    prefijo, de modo que el servidor lo recibe en "/socket.io").
//  - BASE absoluta (p. ej. "http://host:3030", backend directo): se conecta a ese
//    origen con el path por defecto "/socket.io".
const resolveTarget = () => {
  const base = String(API_ROUTES.BASE || "").trim();
  if (/^https?:\/\//i.test(base)) {
    return { url: base, path: "/socket.io" };
  }
  const prefix = base.replace(/\/$/, "");
  return { url: undefined, path: `${prefix}/socket.io` };
};

class RealtimeClient {
  constructor() {
    this.socket = null;
  }

  /**
   * Conecta (idempotente). Si ya hay socket pero el token cambió, reconecta con
   * el token vigente.
   */
  connect() {
    const token = readToken();

    if (this.socket) {
      if (this.socket.auth?.token !== token) {
        this.socket.auth = { token };
        this.socket.disconnect().connect();
      } else if (!this.socket.connected) {
        this.socket.connect();
      }
      return this.socket;
    }

    const { url, path } = resolveTarget();
    const options = {
      path,
      auth: { token },
      transports: ["websocket", "polling"],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000
    };

    // io(url, opts) cuando hay origen explícito; io(opts) para el mismo origen.
    this.socket = url ? io(url, options) : io(options);

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected() {
    return Boolean(this.socket?.connected);
  }

  /**
   * Registra un listener y devuelve una función para quitarlo.
   */
  on(event, handler) {
    this.connect();
    this.socket.on(event, handler);
    return () => {
      this.socket?.off(event, handler);
    };
  }

  off(event, handler) {
    this.socket?.off(event, handler);
  }

  /**
   * Pide al backend unirse al room de una conversación. El backend valida la
   * participación antes de unir. Devuelve { ok, error? }.
   */
  subscribeConversation(conversationId) {
    return this.#emitWithAck("conversation:subscribe", { conversationId });
  }

  unsubscribeConversation(conversationId) {
    this.connect();
    this.socket.emit("conversation:unsubscribe", { conversationId });
  }

  subscribeProcess(processId, scopeUnitId = null) {
    return this.#emitWithAck("process:subscribe", { processId, scopeUnitId });
  }

  unsubscribeProcess(processId) {
    this.connect();
    this.socket.emit("process:unsubscribe", { processId });
  }

  #emitWithAck(event, payload, timeoutMs = 5000) {
    this.connect();
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const timer = setTimeout(() => finish({ ok: false, error: "timeout" }), timeoutMs);
      this.socket.emit(event, payload, (ack) => {
        clearTimeout(timer);
        finish(ack || { ok: true });
      });
    });
  }
}

const realtimeClient = new RealtimeClient();
export default realtimeClient;
