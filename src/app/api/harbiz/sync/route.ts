/**
 * POST /api/harbiz/sync
 * Trigger a Harbiz → GymBook sync (dry-run by default).
 *
 * Query params:
 *   dryRun=true|false  (default: true)
 *
 * Body (optional):
 *   { teacherId?: string }
 *
 * Auth: ADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runHarbizSync } from "@/integrations/harbiz/syncService";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  // ── Auth check ──────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  // ── Parse params ────────────────────────────────────────────────────────
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") !== "false"; // default: true

  let teacherId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    teacherId = body?.teacherId;
  } catch {
    // no body — ok
  }

  // Resolve teacherId: if not provided, use first teacher with a Harbiz connection
  // or just the first teacher
  if (!teacherId) {
    const connection = await prisma.teacherHarbizConnection.findFirst({
      where: { isActive: true },
    });
    if (connection) {
      teacherId = connection.teacherId;
    } else {
      const teacher = await prisma.teacher.findFirst();
      teacherId = teacher?.id;
    }
  }

  if (!teacherId) {
    return NextResponse.json({ error: "No hay profesores configurados" }, { status: 400 });
  }

  // ── Env check ───────────────────────────────────────────────────────────
  if (!process.env.HARBIZ_EMAIL || !process.env.HARBIZ_PASSWORD) {
    return NextResponse.json(
      { error: "Faltan HARBIZ_EMAIL o HARBIZ_PASSWORD en variables de entorno" },
      { status: 500 }
    );
  }

  // ── Run sync ────────────────────────────────────────────────────────────
  try {
    const result = await runHarbizSync({ teacherId, dryRun });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
