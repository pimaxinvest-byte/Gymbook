/**
 * mapper.ts — Harbiz entity → GymBook entity transformations
 *
 * Rules:
 * - Dates always normalized to Europe/Madrid
 * - Emails always lowercased and trimmed
 * - No PII in return values beyond what's needed for Prisma upserts
 */

import {
  HarbizClient,
  HarbizMappedClient,
  HarbizMappedBooking,
  HarbizMappedCredits,
  HarbizSession,
  HarbizSessionPack,
} from "./types";

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Parse a Harbiz date value (string, Date, or undefined) and return a JS Date.
 * Returns null if unparseable.
 */
export function parseHarbizDate(val: string | Date | undefined | null): Date | null {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Normalize a date to a safe UTC-stored value.
 * Harbiz dates may be in UTC; GymBook stores everything as UTC in DB but
 * the application interprets them as Europe/Madrid.
 */
export function normalizeDate(val: string | Date | undefined | null): Date | null {
  return parseHarbizDate(val);
}

/** Add `minutes` minutes to a Date */
function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

// ─── Client mapper ────────────────────────────────────────────────────────────

/**
 * Map a Harbiz client to a GymBook Client-compatible object for upsert.
 */
export function mapClientToGymBook(
  hc: HarbizClient,
  teacherId: string
): HarbizMappedClient {
  return {
    name: [hc.name, hc.lastname].filter(Boolean).join(" ").trim(),
    email: (hc.email ?? "").toLowerCase().trim(),
    phone: hc.phone?.trim() || null,
    status: hc.status === "archived" ? "SUSPENDED" : "ACTIVE",
    preferredTeacherId: teacherId,
  };
}

/**
 * Validate that a mapped client has the required fields.
 */
export function isValidMappedClient(c: HarbizMappedClient): boolean {
  return !!(c.email && c.email.includes("@") && c.name);
}

// ─── Session mapper ───────────────────────────────────────────────────────────

/**
 * Map a Harbiz session to a GymBook Booking-compatible object.
 * Requires resolved gymBookClientId, teacherId, and activityId.
 */
export function mapSessionToGymBook(
  hs: HarbizSession,
  gymBookClientId: string,
  gymBookTeacherId: string,
  activityId: string
): HarbizMappedBooking | null {
  const startDatetime = normalizeDate(hs.startDate);
  if (!startDatetime) return null;

  const endDatetime = normalizeDate(hs.endDate) ?? addMinutes(startDatetime, 60);

  let status: "BOOKED" | "COMPLETED" | "CANCELLED" = "BOOKED";
  if (hs.cancelled === true || hs.status === "cancelled") {
    status = "CANCELLED";
  } else if (hs.attended === true || hs.status === "completed") {
    status = "COMPLETED";
  }

  return {
    clientId: gymBookClientId,
    teacherId: gymBookTeacherId,
    activityId,
    startDatetime,
    endDatetime,
    status,
    sessionType: "INDIVIDUAL",
    capacity: 1,
  };
}

// ─── Session pack (credits) mapper ────────────────────────────────────────────

/**
 * Map a Harbiz session pack (bono) to a GymBook ClientCredits-compatible object.
 */
export function mapPackToGymBook(
  hp: HarbizSessionPack,
  gymBookClientId: string,
  gymBookTeacherId: string
): HarbizMappedCredits {
  const total = hp.totalSessions ?? 0;
  const used = hp.usedSessions ?? 0;
  const remaining = hp.remainingSessions ?? Math.max(0, total - used);

  return {
    clientId: gymBookClientId,
    teacherId: gymBookTeacherId,
    creditType: "INDIVIDUAL",
    balance: remaining,
    totalAssigned: total,
    paymentStatus: hp.paymentStatus === "paid" ? "PAID" : "UNPAID",
    notes: `Importado de Harbiz${hp.sessionTypeName ? `: ${hp.sessionTypeName}` : ""}`,
  };
}

// ─── Label helpers (for diff display — no PII in logs) ───────────────────────

/** Returns a safe display label for a client (initials only) */
export function clientLabel(hc: HarbizClient): string {
  const initial1 = hc.name?.[0]?.toUpperCase() ?? "?";
  const initial2 = hc.lastname?.[0]?.toUpperCase() ?? "";
  return `[${initial1}${initial2}]`;
}

/** Returns a safe display label for a session */
export function sessionLabel(hs: HarbizSession): string {
  const d = parseHarbizDate(hs.startDate);
  return d ? d.toISOString().split("T")[0] : "[fecha desconocida]";
}

/** Returns a safe display label for a pack */
export function packLabel(hp: HarbizSessionPack): string {
  return hp.sessionTypeName
    ? `[Pack:${hp.sessionTypeName.slice(0, 20)}]`
    : "[Pack]";
}
