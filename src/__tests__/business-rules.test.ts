/**
 * GymBook — Business Rule Unit Tests
 * Run with: npx vitest run
 *
 * These tests validate the core logic without hitting the database.
 * For DB integration tests, use a test DB with SEED_DEMO=true.
 */

import { describe, it, expect } from "vitest";

// ─── 1. Conflict detection helpers ───────────────────────────────────────────

/** Simulates the time-overlap check used in checkBookingConflicts */
function hasTimeOverlap(
  aStart: Date, aEnd: Date,
  bStart: Date, bEnd: Date
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

describe("Space & teacher conflict logic", () => {
  const base = new Date("2025-06-10T10:00:00Z");
  const end  = new Date("2025-06-10T11:00:00Z");

  it("detects exact-time overlap", () => {
    expect(hasTimeOverlap(base, end, base, end)).toBe(true);
  });

  it("detects partial overlap (new booking starts inside existing)", () => {
    const newStart = new Date("2025-06-10T10:30:00Z");
    const newEnd   = new Date("2025-06-10T11:30:00Z");
    expect(hasTimeOverlap(base, end, newStart, newEnd)).toBe(true);
  });

  it("detects partial overlap (new booking ends inside existing)", () => {
    const newStart = new Date("2025-06-10T09:30:00Z");
    const newEnd   = new Date("2025-06-10T10:30:00Z");
    expect(hasTimeOverlap(base, end, newStart, newEnd)).toBe(true);
  });

  it("detects engulfing overlap (new booking wraps existing)", () => {
    const newStart = new Date("2025-06-10T09:00:00Z");
    const newEnd   = new Date("2025-06-10T12:00:00Z");
    expect(hasTimeOverlap(base, end, newStart, newEnd)).toBe(true);
  });

  it("allows back-to-back bookings (no gap)", () => {
    // Ends exactly at 11:00, new starts at 11:00 — no overlap
    const newStart = new Date("2025-06-10T11:00:00Z");
    const newEnd   = new Date("2025-06-10T12:00:00Z");
    expect(hasTimeOverlap(base, end, newStart, newEnd)).toBe(false);
  });

  it("allows bookings on different days", () => {
    const tomorrow = new Date("2025-06-11T10:00:00Z");
    const tEnd     = new Date("2025-06-11T11:00:00Z");
    expect(hasTimeOverlap(base, end, tomorrow, tEnd)).toBe(false);
  });
});

// ─── 2. Capacity rules ────────────────────────────────────────────────────────

function canJoinSession(sessionType: "INDIVIDUAL" | "SGT", capacity: number, currentParticipants: number): boolean {
  if (sessionType === "INDIVIDUAL") return currentParticipants === 0;
  return currentParticipants < capacity;
}

describe("Session capacity rules", () => {
  describe("Entrenamiento Personal (INDIVIDUAL, cap 1)", () => {
    it("allows first client to join", () => {
      expect(canJoinSession("INDIVIDUAL", 1, 0)).toBe(true);
    });

    it("blocks second client — already booked", () => {
      expect(canJoinSession("INDIVIDUAL", 1, 1)).toBe(false);
    });
  });

  describe("Yoga (SGT, cap 5)", () => {
    it("allows up to 5 clients", () => {
      for (let i = 0; i < 5; i++) {
        expect(canJoinSession("SGT", 5, i)).toBe(true);
      }
    });

    it("blocks 6th client — group full", () => {
      expect(canJoinSession("SGT", 5, 5)).toBe(false);
    });

    it("blocks 7th client too", () => {
      expect(canJoinSession("SGT", 5, 6)).toBe(false);
    });
  });
});

// ─── 3. Credit validation ─────────────────────────────────────────────────────

function canDeductCredit(balance: number, expiresAt: Date | null, now = new Date()): { ok: boolean; reason?: string } {
  if (expiresAt && expiresAt < now) return { ok: false, reason: "Créditos caducados" };
  if (balance < 1) return { ok: false, reason: "Sin créditos suficientes" };
  return { ok: true };
}

describe("Credit system", () => {
  it("allows booking when credits are valid", () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    expect(canDeductCredit(3, future).ok).toBe(true);
  });

  it("blocks booking when balance is zero", () => {
    const result = canDeductCredit(0, null);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Sin créditos");
  });

  it("blocks booking when credits have expired", () => {
    const pastDate = new Date(Date.now() - 1000);
    const result = canDeductCredit(5, pastDate);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("caducados");
  });

  it("allows booking with no expiry date", () => {
    expect(canDeductCredit(2, null).ok).toBe(true);
  });
});

// ─── 4. Client onboarding status ─────────────────────────────────────────────

type ClientStatus = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";

function canClientBook(status: ClientStatus): boolean {
  return status === "ACTIVE";
}

function getWelcomeAction(status: ClientStatus): "send_welcome" | "send_rejection" | "none" {
  if (status === "ACTIVE")   return "send_welcome";
  if (status === "REJECTED") return "send_rejection";
  return "none";
}

describe("Client onboarding", () => {
  it("PENDING client cannot book", () => {
    expect(canClientBook("PENDING")).toBe(false);
  });

  it("ACTIVE client can book", () => {
    expect(canClientBook("ACTIVE")).toBe(true);
  });

  it("REJECTED client cannot book", () => {
    expect(canClientBook("REJECTED")).toBe(false);
  });

  it("SUSPENDED client cannot book", () => {
    expect(canClientBook("SUSPENDED")).toBe(false);
  });

  it("sends welcome message when client is approved", () => {
    expect(getWelcomeAction("ACTIVE")).toBe("send_welcome");
  });

  it("sends rejection message when client is rejected", () => {
    expect(getWelcomeAction("REJECTED")).toBe("send_rejection");
  });

  it("sends nothing for pending state", () => {
    expect(getWelcomeAction("PENDING")).toBe("none");
  });
});

// ─── 5. Telegram notification guard ──────────────────────────────────────────

function canSendTelegramMessage(chatId: string | null | undefined): boolean {
  return !!(chatId && chatId.trim() !== "");
}

describe("Telegram notification guard", () => {
  it("allows sending when chatId is set", () => {
    expect(canSendTelegramMessage("123456789")).toBe(true);
  });

  it("blocks sending when chatId is null", () => {
    expect(canSendTelegramMessage(null)).toBe(false);
  });

  it("blocks sending when chatId is undefined", () => {
    expect(canSendTelegramMessage(undefined)).toBe(false);
  });

  it("blocks sending when chatId is empty string", () => {
    expect(canSendTelegramMessage("")).toBe(false);
  });

  it("blocks sending when chatId is whitespace only", () => {
    expect(canSendTelegramMessage("   ")).toBe(false);
  });
});

// ─── 6. Cancellation policy ───────────────────────────────────────────────────

function canCancelWithRefund(
  sessionStart: Date,
  hoursLimit: number,
  now = new Date()
): boolean {
  const hoursUntilSession = (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilSession >= hoursLimit;
}

describe("Cancellation policy", () => {
  const now = new Date("2025-06-10T10:00:00Z");

  it("allows refund when cancelling 48h before (limit=24)", () => {
    const session = new Date("2025-06-12T10:00:00Z"); // 48h ahead
    expect(canCancelWithRefund(session, 24, now)).toBe(true);
  });

  it("allows refund exactly at the limit", () => {
    const session = new Date("2025-06-11T10:00:00Z"); // exactly 24h
    expect(canCancelWithRefund(session, 24, now)).toBe(true);
  });

  it("denies refund when cancelling inside the limit", () => {
    const session = new Date("2025-06-10T18:00:00Z"); // only 8h ahead
    expect(canCancelWithRefund(session, 24, now)).toBe(false);
  });

  it("denies refund for past sessions", () => {
    const past = new Date("2025-06-09T10:00:00Z");
    expect(canCancelWithRefund(past, 24, now)).toBe(false);
  });
});
