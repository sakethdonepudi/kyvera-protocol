import { WebSocketServer, type WebSocket } from "ws";
import { matchFilter, verifyEvent, type Event, type Filter } from "nostr-tools";

export interface LocalRelayOptions {
  /** Accept events without verifying signatures (simulates a malicious relay). */
  verifySignatures?: boolean;
  /** Do not send EOSE, simulating a relay that hangs after sending events. */
  omitEose?: boolean;
  /** Delay before answering, in ms. */
  delayMs?: number;
}

/** Minimal in-memory Nostr relay for tests and the offline demo. */
export class LocalRelay {
  readonly port: number;
  readonly url: string;
  readonly events = new Map<string, Event>();
  private readonly server: WebSocketServer;
  private readonly sockets = new Set<WebSocket>();
  private readonly options: LocalRelayOptions;

  private constructor(server: WebSocketServer, port: number, options: LocalRelayOptions) {
    this.server = server;
    this.port = port;
    this.url = `ws://127.0.0.1:${port}`;
    this.options = options;
    server.on("connection", (socket) => this.handle(socket));
  }

  static async start(options: LocalRelayOptions = {}): Promise<LocalRelay> {
    const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    if (typeof address === "string" || address === null) throw new Error("failed to bind relay");
    return new LocalRelay(server, address.port, options);
  }

  seed(...events: Event[]): void {
    for (const event of events) this.events.set(event.id, event);
  }

  private handle(socket: WebSocket): void {
    this.sockets.add(socket);
    socket.on("close", () => this.sockets.delete(socket));
    socket.on("message", (raw) => {
      let message: unknown;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!Array.isArray(message)) return;
      const [type] = message;

      if (type === "EVENT") {
        const event = message[1] as Event;
        const valid = this.options.verifySignatures === false ? true : verifyEvent(event);
        if (!valid || !event?.id) {
          socket.send(JSON.stringify(["OK", event?.id ?? "", false, "invalid: bad signature"]));
          return;
        }
        this.events.set(event.id, event);
        socket.send(JSON.stringify(["OK", event.id, true, ""]));
        return;
      }

      if (type === "REQ") {
        const subscriptionId = String(message[1]);
        const filters = message.slice(2) as Filter[];
        const deliver = () => {
          for (const event of this.events.values()) {
            if (filters.some((filter) => matchFilter(filter, event))) {
              socket.send(JSON.stringify(["EVENT", subscriptionId, event]));
            }
          }
          if (!this.options.omitEose) socket.send(JSON.stringify(["EOSE", subscriptionId]));
        };
        if (this.options.delayMs) setTimeout(deliver, this.options.delayMs);
        else deliver();
        return;
      }

      if (type === "CLOSE") return;
    });
  }

  async close(): Promise<void> {
    for (const socket of this.sockets) socket.terminate();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
