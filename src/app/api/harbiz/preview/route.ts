import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/harbiz/preview
 * Returns a structured field-mapping preview of what a Harbiz import would do.
 * Shows: source field → GymBook field → sample value → action → risk level.
 * Does NOT call Harbiz; instead reads the most-recent dry-run log if available,
 * or returns the static field-mapping schema so the user knows what will be imported.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve teacher
  let teacherId: string | null = null;
  if (session.user.role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    teacherId = teacher.id;
  }

  // Find most recent successful dry-run log for this teacher (or global for admin)
  const connectionWhere = teacherId
    ? { connection: { teacherId } }
    : {};
  const lastDryRun = await prisma.externalSyncLog.findFirst({
    where: {
      dryRun: true,
      status: "COMPLETED",
      ...connectionWhere,
    },
    orderBy: { startedAt: "desc" },
    select: {
      clientsFound: true,
      clientsCreated: true,
      clientsUpdated: true,
      sessionsFound: true,
      sessionsCreated: true,
      packsFound: true,
      packsCreated: true,
      startedAt: true,
    },
  });

  // Static field-mapping schema (what we import from Harbiz and where it goes in GymBook)
  const fieldMappings = [
    // CLIENTS
    { entity: "Cliente", harbizField: "name", gymField: "User.name",       description: "Nombre completo",            risk: "LOW",    action: "UPSERT" },
    { entity: "Cliente", harbizField: "email", gymField: "User.email",     description: "Email (clave de deduplicación)", risk: "MEDIUM", action: "UPSERT" },
    { entity: "Cliente", harbizField: "phone", gymField: "Client.phone",   description: "Teléfono",                   risk: "LOW",    action: "UPSERT" },
    { entity: "Cliente", harbizField: "dob",   gymField: "Client.dob",     description: "Fecha de nacimiento",        risk: "LOW",    action: "UPSERT" },
    { entity: "Cliente", harbizField: "id",    gymField: "Client.harbizId",description: "ID Harbiz (auditoría)",      risk: "LOW",    action: "SET_ONCE" },
    // SESSIONS / BOOKINGS
    { entity: "Sesión",  harbizField: "startDate",   gymField: "Booking.startDatetime", description: "Fecha y hora inicio",    risk: "LOW",    action: "CREATE" },
    { entity: "Sesión",  harbizField: "duration",    gymField: "Booking.endDatetime",   description: "Calculada: inicio+duración", risk: "LOW", action: "CREATE" },
    { entity: "Sesión",  harbizField: "clientEmail", gymField: "Booking.clientId",      description: "Vinculado por email",    risk: "MEDIUM", action: "CREATE" },
    { entity: "Sesión",  harbizField: "(default)",   gymField: "Booking.activityId",    description: "Entrenamiento Personal", risk: "LOW",    action: "DEFAULT" },
    { entity: "Sesión",  harbizField: "(default)",   gymField: "Booking.spaceId",       description: "SALA (nombre exacto)",   risk: "LOW",    action: "DEFAULT" },
    { entity: "Sesión",  harbizField: "(default)",   gymField: "Booking.sessionType",   description: "INDIVIDUAL",             risk: "LOW",    action: "DEFAULT" },
    // PACKS / CREDIT PACKAGES
    { entity: "Bono",    harbizField: "sessions",    gymField: "ClientCredits.balance", description: "Créditos disponibles",   risk: "HIGH",   action: "CREATE" },
    { entity: "Bono",    harbizField: "packType",    gymField: "ClientCredits.creditType", description: "INDIVIDUAL o SGT",   risk: "LOW",    action: "CREATE" },
    { entity: "Bono",    harbizField: "clientEmail", gymField: "ClientCredits.clientId",   description: "Vinculado por email", risk: "MEDIUM", action: "CREATE" },
  ];

  return NextResponse.json({
    lastDryRun: lastDryRun ?? null,
    fieldMappings,
    warnings: [
      "Los emails se usan como clave de deduplicación. Si un cliente cambia su email en Harbiz, se creará un registro duplicado.",
      "Los créditos importados (bonos) se añaden al balance existente — no se reemplazan.",
      "Las sesiones pasadas (anteriores a hoy) NO se importan.",
      "Harbiz se accede en modo lectura. Ningún dato de Harbiz es modificado.",
    ],
  });
}
