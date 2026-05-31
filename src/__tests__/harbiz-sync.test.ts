/**
 * Tests for Harbiz integration — mapper and dedup logic
 * All pure functions, no DDP connection required.
 */

import { describe, it, expect } from "vitest";
import {
  mapClientToGymBook,
  mapSessionToGymBook,
  mapPackToGymBook,
  isValidMappedClient,
  parseHarbizDate,
  clientLabel,
  sessionLabel,
  packLabel,
} from "../integrations/harbiz/mapper";
import type { HarbizClient, HarbizSession, HarbizSessionPack } from "../integrations/harbiz/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEACHER_ID = "teacher-123";
const CLIENT_ID = "gymbook-user-456";
const ACTIVITY_ID = "activity-789";

const sampleClient: HarbizClient = {
  _id: "harbizClientId001",
  profId: "harbizProfId001",
  name: "Juan",
  lastname: "García",
  email: "JUAN.GARCIA@EXAMPLE.COM",
  phone: " +34 600 123 456 ",
  status: "active",
  type: "presencial",
};

const sampleArchivedClient: HarbizClient = {
  ...sampleClient,
  _id: "harbizClientId002",
  status: "archived",
};

const sampleSession: HarbizSession = {
  _id: "harbizSessionId001",
  clientId: "harbizClientId001",
  profId: "harbizProfId001",
  startDate: "2026-06-01T10:00:00.000Z",
  endDate: "2026-06-01T11:00:00.000Z",
  status: "scheduled",
  isPresencial: true,
  isOnline: false,
};

const sampleCompletedSession: HarbizSession = {
  ...sampleSession,
  _id: "harbizSessionId002",
  status: "completed",
  attended: true,
};

const sampleCancelledSession: HarbizSession = {
  ...sampleSession,
  _id: "harbizSessionId003",
  status: "cancelled",
  cancelled: true,
};

const samplePack: HarbizSessionPack = {
  _id: "harbizPackId001",
  clientId: "harbizClientId001",
  profId: "harbizProfId001",
  sessionTypeName: "Entrenamiento presencial",
  totalSessions: 10,
  usedSessions: 3,
  remainingSessions: 7,
  paymentStatus: "paid",
};

const sampleUnpaidPack: HarbizSessionPack = {
  ...samplePack,
  _id: "harbizPackId002",
  paymentStatus: "pending",
  totalSessions: 5,
  usedSessions: 0,
  remainingSessions: 5,
};

// ─── parseHarbizDate ──────────────────────────────────────────────────────────

describe("parseHarbizDate", () => {
  it("parses ISO string", () => {
    const d = parseHarbizDate("2026-06-01T10:00:00.000Z");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
  });

  it("returns Date unchanged", () => {
    const now = new Date();
    const result = parseHarbizDate(now);
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(now.getTime());
  });

  it("returns null for undefined", () => {
    expect(parseHarbizDate(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseHarbizDate(null)).toBeNull();
  });

  it("returns null for invalid date string", () => {
    expect(parseHarbizDate("not-a-date")).toBeNull();
  });
});

// ─── mapClientToGymBook ───────────────────────────────────────────────────────

describe("mapClientToGymBook", () => {
  it("maps basic fields correctly", () => {
    const result = mapClientToGymBook(sampleClient, TEACHER_ID);
    expect(result.name).toBe("Juan García");
    expect(result.email).toBe("juan.garcia@example.com"); // lowercased
    expect(result.phone).toBe("+34 600 123 456"); // trimmed
    expect(result.preferredTeacherId).toBe(TEACHER_ID);
  });

  it("normalizes email to lowercase", () => {
    const result = mapClientToGymBook({ ...sampleClient, email: "TEST@EXAMPLE.COM" }, TEACHER_ID);
    expect(result.email).toBe("test@example.com");
  });

  it("maps active client to ACTIVE status", () => {
    const result = mapClientToGymBook(sampleClient, TEACHER_ID);
    expect(result.status).toBe("ACTIVE");
  });

  it("maps archived client to SUSPENDED status", () => {
    const result = mapClientToGymBook(sampleArchivedClient, TEACHER_ID);
    expect(result.status).toBe("SUSPENDED");
  });

  it("handles missing lastname", () => {
    const c = { ...sampleClient, lastname: undefined };
    const result = mapClientToGymBook(c, TEACHER_ID);
    expect(result.name).toBe("Juan");
    expect(result.name).not.toContain("undefined");
  });

  it("returns null phone when missing", () => {
    const c = { ...sampleClient, phone: undefined };
    const result = mapClientToGymBook(c, TEACHER_ID);
    expect(result.phone).toBeNull();
  });

  it("returns null phone when empty string", () => {
    const c = { ...sampleClient, phone: "" };
    const result = mapClientToGymBook(c, TEACHER_ID);
    expect(result.phone).toBeNull();
  });
});

// ─── isValidMappedClient ──────────────────────────────────────────────────────

describe("isValidMappedClient", () => {
  it("returns true for valid client", () => {
    const mapped = mapClientToGymBook(sampleClient, TEACHER_ID);
    expect(isValidMappedClient(mapped)).toBe(true);
  });

  it("returns false when email missing", () => {
    expect(isValidMappedClient({ name: "Juan", email: "", phone: null, status: "ACTIVE", preferredTeacherId: TEACHER_ID })).toBe(false);
  });

  it("returns false when email has no @", () => {
    expect(isValidMappedClient({ name: "Juan", email: "notanemail", phone: null, status: "ACTIVE", preferredTeacherId: TEACHER_ID })).toBe(false);
  });

  it("returns false when name missing", () => {
    expect(isValidMappedClient({ name: "", email: "a@b.com", phone: null, status: "ACTIVE", preferredTeacherId: TEACHER_ID })).toBe(false);
  });
});

// ─── mapSessionToGymBook ──────────────────────────────────────────────────────

describe("mapSessionToGymBook", () => {
  it("maps scheduled session to BOOKED", () => {
    const result = mapSessionToGymBook(sampleSession, CLIENT_ID, TEACHER_ID, ACTIVITY_ID);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("BOOKED");
    expect(result!.clientId).toBe(CLIENT_ID);
    expect(result!.teacherId).toBe(TEACHER_ID);
    expect(result!.activityId).toBe(ACTIVITY_ID);
    expect(result!.sessionType).toBe("INDIVIDUAL");
    expect(result!.capacity).toBe(1);
  });

  it("maps completed session to COMPLETED", () => {
    const result = mapSessionToGymBook(sampleCompletedSession, CLIENT_ID, TEACHER_ID, ACTIVITY_ID);
    expect(result!.status).toBe("COMPLETED");
  });

  it("maps cancelled session to CANCELLED", () => {
    const result = mapSessionToGymBook(sampleCancelledSession, CLIENT_ID, TEACHER_ID, ACTIVITY_ID);
    expect(result!.status).toBe("CANCELLED");
  });

  it("parses startDate from ISO string", () => {
    const result = mapSessionToGymBook(sampleSession, CLIENT_ID, TEACHER_ID, ACTIVITY_ID);
    expect(result!.startDatetime).toBeInstanceOf(Date);
    expect(result!.startDatetime.toISOString()).toContain("2026-06-01");
  });

  it("parses endDate from ISO string", () => {
    const result = mapSessionToGymBook(sampleSession, CLIENT_ID, TEACHER_ID, ACTIVITY_ID);
    expect(result!.endDatetime).toBeInstanceOf(Date);
    expect(result!.endDatetime.toISOString()).toContain("2026-06-01T11:00");
  });

  it("defaults endDate to startDate + 60min when missing", () => {
    const s = { ...sampleSession, endDate: undefined };
    const result = mapSessionToGymBook(s, CLIENT_ID, TEACHER_ID, ACTIVITY_ID);
    const diffMs = result!.endDatetime.getTime() - result!.startDatetime.getTime();
    expect(diffMs).toBe(60 * 60 * 1000);
  });

  it("returns null for missing startDate", () => {
    const s = { ...sampleSession, startDate: "" };
    const result = mapSessionToGymBook(s, CLIENT_ID, TEACHER_ID, ACTIVITY_ID);
    expect(result).toBeNull();
  });
});

// ─── mapPackToGymBook ─────────────────────────────────────────────────────────

describe("mapPackToGymBook", () => {
  it("maps basic pack fields", () => {
    const result = mapPackToGymBook(samplePack, CLIENT_ID, TEACHER_ID);
    expect(result.balance).toBe(7);
    expect(result.totalAssigned).toBe(10);
    expect(result.creditType).toBe("INDIVIDUAL");
    expect(result.clientId).toBe(CLIENT_ID);
    expect(result.teacherId).toBe(TEACHER_ID);
  });

  it("maps paid pack to PAID status", () => {
    const result = mapPackToGymBook(samplePack, CLIENT_ID, TEACHER_ID);
    expect(result.paymentStatus).toBe("PAID");
  });

  it("maps pending pack to UNPAID status", () => {
    const result = mapPackToGymBook(sampleUnpaidPack, CLIENT_ID, TEACHER_ID);
    expect(result.paymentStatus).toBe("UNPAID");
  });

  it("includes session type name in notes", () => {
    const result = mapPackToGymBook(samplePack, CLIENT_ID, TEACHER_ID);
    expect(result.notes).toContain("Entrenamiento presencial");
  });

  it("calculates remaining from total-used when remainingSessions missing", () => {
    const p = { ...samplePack, remainingSessions: undefined, totalSessions: 10, usedSessions: 4 };
    const result = mapPackToGymBook(p, CLIENT_ID, TEACHER_ID);
    expect(result.balance).toBe(6);
  });

  it("defaults to 0 balance when all fields missing", () => {
    const p = { ...samplePack, remainingSessions: undefined, totalSessions: 0, usedSessions: 0 };
    const result = mapPackToGymBook(p, CLIENT_ID, TEACHER_ID);
    expect(result.balance).toBe(0);
  });
});

// ─── Label helpers (no PII) ───────────────────────────────────────────────────

describe("clientLabel", () => {
  it("returns initials only (no real name)", () => {
    const label = clientLabel(sampleClient);
    expect(label).toBe("[JG]");
    expect(label).not.toContain("Juan");
    expect(label).not.toContain("García");
  });

  it("handles missing lastname", () => {
    const label = clientLabel({ ...sampleClient, lastname: undefined });
    expect(label).toBe("[J]");
  });
});

describe("sessionLabel", () => {
  it("returns date string (no client info)", () => {
    const label = sessionLabel(sampleSession);
    expect(label).toBe("2026-06-01");
    expect(label).not.toContain("harbizClientId");
  });

  it("returns fallback for invalid date", () => {
    const label = sessionLabel({ ...sampleSession, startDate: "" });
    expect(label).toContain("fecha desconocida");
  });
});

describe("packLabel", () => {
  it("includes session type name (may be truncated to 20 chars)", () => {
    const label = packLabel(samplePack);
    // packLabel truncates session type name to 20 chars
    expect(label).toContain("Entrenamiento presen");
    expect(label).toMatch(/^\[Pack:/);
  });

  it("returns generic label when no session type", () => {
    const label = packLabel({ ...samplePack, sessionTypeName: undefined });
    expect(label).toBe("[Pack]");
  });
});
