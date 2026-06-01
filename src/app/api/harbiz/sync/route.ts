/**
 * POST /api/harbiz/sync
 * Trigger a Harbiz → GymBook sync (dry-run by default).
 *
 * Query params:
 *   dryRun=true|false  (default: true)
 *
 * Body (optional, admin only):
 *   { teacherId?: string }
 *
 * Auth: ADMIN or TEACHER (teacher can only sync own data; must have granted import consent).
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
  const isAdmin = session.user.role === "ADMIN";
  const isTeacher = session.user.role === "TEACHER";
  if (!isAdmin && !isTeacher) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  // ── Parse params ────────────────────────────────────────────────────────
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") !== "false"; // default: true

  let teacherId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    // Only admin can specify an arbitrary teacherId
    if (isAdmin && body?.teacherId) teacherId = body.teacherId;
  } catch {
    // no body — ok
  }

  // Teachers always sync their own account
  if (isTeacher) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });
    teacherId = teacher.id;

    // Consent check: teacher must have granted import permission
    const permission = await prisma.externalImportPermission.findUnique({
      where: { teacherId },
      select: { revokedAt: true },
    });
    if (!permission || permission.revokedAt) {
      return NextResponse.json(
        { error: "Debes aceptar el consentimiento de importación antes de sincronizar" },
        { status: 403 }
      );
    }
  }

  // Admins: resolve teacherId if not provided
  if (isAdmin && !teacherId) {
    const connection = await prisma.teacherHarbizConnection.findFirst({ where: { isActive: true } });
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

  // ── Credential check ────────────────────────────────────────────────────
  // Credentials can come from either: (1) per-teacher DB record, or (2) env vars.
  // The syncService resolves this. We just verify at least one source exists.
  const connection = await prisma.teacherHarbizConnection.findUnique({
    where: { teacherId },
    select: { harbizEmail: true, harbizPasswordEncrypted: true },
  });
  const hasDbCreds = !!(connection?.harbizEmail && connection?.harbizPasswordEncrypted);
  const hasEnvCreds = !!(process.env.HARBIZ_EMAIL && process.env.HARBIZ_PASSWORD);
  if (!hasDbCreds && !hasEnvCreds) {
    return NextResponse.json(
      { error: "No hay credenciales Harbiz configuradas para este profesor" },
      { status: 400 }
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
