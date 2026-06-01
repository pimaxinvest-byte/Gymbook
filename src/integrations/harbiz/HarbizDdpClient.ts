/**
 * HarbizDdpClient — DDP client for Harbiz (Meteor 3.4)
 *
 * Harbiz exposes no REST API. All data access is via DDP over SockJS.
 * This client wraps `simpleddp` to provide typed method calls.
 *
 * SECURITY: Never log tokens, emails, or passwords. Credentials come from env vars only.
 */

import SimpleDDP from "simpleddp";
import { createHash } from "crypto";
import type {
  HarbizClient,
  HarbizSession,
  HarbizSessionPack,
  HarbizSessionType,
} from "./types";

// simpleddp uses CommonJS default export
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SimpleDDPCtor = require("simpleddp");

// Standard Meteor DDP WebSocket endpoint (NOT SockJS /info — that causes a timeout).
// Meteor exposes DDP over plain WebSocket at /websocket.
const HARBIZ_WS_ENDPOINT = "wss://app.harbiz.io/websocket";
const CONNECT_TIMEOUT_MS = 30_000;
const CALL_TIMEOUT_MS = 20_000;

interface DDPCallable {
  call(method: string, ...args: unknown[]): Promise<unknown>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  on(event: string, cb: () => void): void;
}

export class HarbizDdpClient {
  private ddp: DDPCallable | null = null;
  private connected = false;

  /**
   * Establish DDP WebSocket connection to Harbiz.
   * Must call before any other methods.
   */
  async connect(): Promise<void> {
    const ws =
      typeof globalThis.WebSocket !== "undefined"
        ? globalThis.WebSocket
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        : require("ws");

    this.ddp = new SimpleDDPCtor({
      endpoint: HARBIZ_WS_ENDPOINT,
      SocketConstructor: ws,
      reconnectInterval: 5000,
      autoConnect: false,
      autoReconnect: false,
    }) as DDPCallable;

    await Promise.race([
      this.ddp.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DDP connect timeout")), CONNECT_TIMEOUT_MS)
      ),
    ]);

    this.connected = true;
  }

  /**
   * Authenticate with Harbiz using email + password.
   * Password is SHA-256 hashed before sending (Meteor standard).
   * NEVER log the password or returned token.
   */
  async login(email: string, password: string): Promise<void> {
    if (!this.ddp || !this.connected) throw new Error("Not connected");

    const digest = createHash("sha256").update(password).digest("hex");

    await this.call("login", {
      user: { email },
      password: { digest, algorithm: "sha-256" },
    });
  }

  /**
   * Fetch paginated list of clients for the logged-in professional.
   */
  async getClients(opts: { limit: number; skip: number } = { limit: 50, skip: 0 }): Promise<HarbizClient[]> {
    const result = await this.call(
      "professional.clients.getPaginatedClients",
      { limit: opts.limit, skip: opts.skip, sort: { activationDate: -1 } },
      { clientType: "active", search: "", filters: {} },
      false
    );
    return (result as HarbizClient[]) ?? [];
  }

  /**
   * Fetch archived clients.
   */
  async getArchivedClients(opts: { limit: number; skip: number } = { limit: 50, skip: 0 }): Promise<HarbizClient[]> {
    const result = await this.call(
      "professional.clients.getPaginatedClients",
      { limit: opts.limit, skip: opts.skip, sort: { activationDate: -1 } },
      { clientType: "archived", search: "", filters: {} },
      false
    );
    return (result as HarbizClient[]) ?? [];
  }

  /**
   * Fetch sessions/bookings in a date range.
   * Equivalent to GymBook GET /api/bookings.
   */
  async getSessionsByDateRange(startDate: Date, endDate: Date): Promise<HarbizSession[]> {
    const result = await this.call("allLiveSessionsByDateMethod", {
      startDate,
      endDate,
      options: {},
    });
    return (result as HarbizSession[]) ?? [];
  }

  /**
   * Fetch session packs (bonos/créditos) for a specific client.
   * Equivalent to GymBook GET /api/credits?clientId=...
   */
  async getSessionPacksByClient(clientId: string): Promise<HarbizSessionPack[]> {
    const result = await this.call(
      "sessionPacks.getSessionPacksByClientId",
      clientId
    );
    return (result as HarbizSessionPack[]) ?? [];
  }

  /**
   * Fetch all session types (equivalent to GymBook Activities).
   */
  async getSessionTypes(): Promise<HarbizSessionType[]> {
    const result = await this.call("getAllSessionTypes");
    return (result as HarbizSessionType[]) ?? [];
  }

  /**
   * Safely disconnect from Harbiz DDP.
   * Always call this in a finally block.
   */
  async disconnect(): Promise<void> {
    if (this.ddp && this.connected) {
      try {
        await this.ddp.disconnect();
      } catch {
        // ignore disconnect errors
      } finally {
        this.connected = false;
        this.ddp = null;
      }
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async call(method: string, ...args: unknown[]): Promise<unknown> {
    if (!this.ddp) throw new Error("Not connected to Harbiz");

    return Promise.race([
      this.ddp.call(method, ...args),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`DDP call '${method}' timed out`)),
          CALL_TIMEOUT_MS
        )
      ),
    ]);
  }
}
