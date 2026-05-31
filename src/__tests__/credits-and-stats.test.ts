/**
 * GymBook — Credit Payment & Stats Unit Tests
 * Run with: npx vitest run src/__tests__/credits-and-stats.test.ts
 *
 * Pure-function tests — no DB access required.
 */

import { describe, it, expect } from "vitest";

// ─── Pure helpers (defined inline) ───────────────────────────────────────────

function calculateCreditBalance(totalAssigned: number, balance: number) {
  return { used: totalAssigned - balance, available: balance, totalAssigned };
}

function isExpired(expiresAt: string | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < now;
}

function paymentStatusLabel(status: "PAID" | "UNPAID" | "PARTIAL"): string {
  const map: Record<string, string> = {
    PAID: "Pagado",
    UNPAID: "Sin pagar",
    PARTIAL: "Parcial",
  };
  return map[status];
}

function paymentMethodLabel(
  method: "CASH" | "CARD" | "TRANSFER" | "BIZUM" | "OTHER"
): string {
  const map: Record<string, string> = {
    CASH: "Efectivo",
    CARD: "Tarjeta",
    TRANSFER: "Transferencia",
    BIZUM: "Bizum",
    OTHER: "Otro",
  };
  return map[method];
}

function creditLogActionDescription(
  actionType: string,
  amount?: number,
  activityName?: string
): string {
  switch (actionType) {
    case "CREDIT_USED":
      return activityName
        ? `crédito usado — Sesión ${activityName}`
        : "crédito usado";
    case "CREDIT_RESTORED":
      return "crédito restaurado";
    case "CREATED":
      return `+${amount ?? 0} créditos asignados`;
    case "MARKED_PAID":
      return amount !== undefined
        ? `Marcado como pagado (€${amount})`
        : "Marcado como pagado";
    case "MARKED_UNPAID":
      return "Marcado como sin pagar";
    case "PARTIALLY_PAID":
      return `Pago parcial (€${amount ?? 0})`;
    case "ADJUSTED":
      return `Ajuste de créditos: ${amount ?? 0}`;
    case "CANCELLED":
      return "Créditos cancelados";
    default:
      return actionType;
  }
}

function formatCreditExpiry(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function occupancyRate(total: number, available: number): number {
  if (total === 0) return 0;
  return ((total - available) / total) * 100;
}

/** Monday = 0, Sunday = 6 */
function weekdayFromDate(date: Date): number {
  const day = date.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  return day === 0 ? 6 : day - 1;
}

function topDemandDay(demandByDay: number[]): number {
  let maxIndex = 0;
  for (let i = 1; i < demandByDay.length; i++) {
    if (demandByDay[i] > demandByDay[maxIndex]) maxIndex = i;
  }
  return maxIndex;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("calculateCreditBalance", () => {
  it("returns used credits correctly when totalAssigned=10 and balance=3", () => {
    const result = calculateCreditBalance(10, 3);
    expect(result.used).toBe(7);
    expect(result.available).toBe(3);
    expect(result.totalAssigned).toBe(10);
  });
});

describe("isExpired", () => {
  it("returns true when expiresAt is yesterday", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired(yesterday)).toBe(true);
  });

  it("returns false when expiresAt is tomorrow", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired(tomorrow)).toBe(false);
  });

  it("returns false when expiresAt is null", () => {
    expect(isExpired(null)).toBe(false);
  });
});

describe("paymentStatusLabel", () => {
  it("maps PAID to Pagado", () => {
    expect(paymentStatusLabel("PAID")).toBe("Pagado");
  });

  it("maps UNPAID to Sin pagar", () => {
    expect(paymentStatusLabel("UNPAID")).toBe("Sin pagar");
  });

  it("maps PARTIAL to Parcial", () => {
    expect(paymentStatusLabel("PARTIAL")).toBe("Parcial");
  });
});

describe("paymentMethodLabel", () => {
  it("maps CASH to Efectivo", () => {
    expect(paymentMethodLabel("CASH")).toBe("Efectivo");
  });

  it("maps CARD to Tarjeta", () => {
    expect(paymentMethodLabel("CARD")).toBe("Tarjeta");
  });

  it("maps TRANSFER to Transferencia", () => {
    expect(paymentMethodLabel("TRANSFER")).toBe("Transferencia");
  });

  it("maps BIZUM to Bizum", () => {
    expect(paymentMethodLabel("BIZUM")).toBe("Bizum");
  });

  it("maps OTHER to Otro", () => {
    expect(paymentMethodLabel("OTHER")).toBe("Otro");
  });
});

describe("creditLogActionDescription", () => {
  it("CREDIT_USED includes 'crédito usado'", () => {
    const desc = creditLogActionDescription("CREDIT_USED", undefined, "Yoga");
    expect(desc).toContain("crédito usado");
  });

  it("CREDIT_RESTORED includes 'restaurado'", () => {
    const desc = creditLogActionDescription("CREDIT_RESTORED");
    expect(desc).toContain("restaurado");
  });

  it("MARKED_PAID includes 'pagado'", () => {
    const desc = creditLogActionDescription("MARKED_PAID", 50);
    expect(desc).toContain("pagado");
  });
});

describe("formatCreditExpiry", () => {
  it("formats date in Spanish locale correctly", () => {
    const result = formatCreditExpiry("2025-12-15T00:00:00.000Z");
    // Should include "diciembre" and "2025"
    expect(result).toContain("2025");
    expect(result.toLowerCase()).toContain("diciembre");
  });
});

describe("occupancyRate", () => {
  it("returns ~83.33 when total=12 and available=2", () => {
    // (12-2)/12 * 100 = 10/12 * 100 ≈ 83.33
    const rate = occupancyRate(12, 2);
    expect(rate).toBeCloseTo(83.33, 1);
  });
});

describe("weekdayFromDate", () => {
  it("Monday returns 0", () => {
    // 2025-06-02 is a Monday
    expect(weekdayFromDate(new Date("2025-06-02T12:00:00Z"))).toBe(0);
  });

  it("Sunday returns 6", () => {
    // 2025-06-08 is a Sunday
    expect(weekdayFromDate(new Date("2025-06-08T12:00:00Z"))).toBe(6);
  });
});

describe("topDemandDay", () => {
  it("returns index 5 (Saturday) as highest demand day", () => {
    // Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
    const demand = [3, 5, 2, 4, 1, 6, 2];
    expect(topDemandDay(demand)).toBe(5);
  });
});
