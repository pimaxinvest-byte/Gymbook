/**
 * GET  /api/harbiz/connection?teacherId=xxx
 *   Returns the Harbiz connection record for a teacher (no password).
 *
 * POST /api/harbiz/connection
 *   Upsert a Harbiz connection for a teacher.
 *   Body: { teacherId, harbizEmail, harbizPassword? }
 *
 * Auth: ADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encrypt";

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const teacherId = req.nextUrl.searchParams.get("teacherId");
  if (!teacherId) {
    return NextResponse.json({ error: "teacherId requerido" }, { status: 400 });
  }

  const connection = await prisma.teacherHarbizConnection.findUnique({
    where: { teacherId },
    select: {
      id: true,
      teacherId: true,
      harbizEmail: true,
      // Never return harbizPasswordEncrypted
      harbizProfId: true,
      lastSyncAt: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!connection) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    hasPassword: true, // if record exists, password is set (or uses env vars)
    ...connection,
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { teacherId, harbizEmail, harbizPassword } = body as {
    teacherId?: string;
    harbizEmail?: string;
    harbizPassword?: string;
  };

  if (!teacherId) {
    return NextResponse.json({ error: "teacherId requerido" }, { status: 400 });
  }

  // Verify teacher exists
  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher) {
    return NextResponse.json({ error: "Profesor no encontrado" }, { status: 404 });
  }

  // Build update data
  const data: {
    harbizEmail?: string;
    harbizPasswordEncrypted?: string;
    isActive: boolean;
  } = { isActive: true };

  if (harbizEmail !== undefined) {
    data.harbizEmail = harbizEmail.toLowerCase().trim();
  }
  if (harbizPassword) {
    data.harbizPasswordEncrypted = encrypt(harbizPassword);
  }

  const connection = await prisma.teacherHarbizConnection.upsert({
    where: { teacherId },
    create: {
      teacherId,
      harbizEmail: data.harbizEmail,
      harbizPasswordEncrypted: data.harbizPasswordEncrypted,
      isActive: true,
    },
    update: data,
    select: {
      id: true,
      teacherId: true,
      harbizEmail: true,
      isActive: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, connection });
}
