import { prisma } from "@/lib/prisma";

interface ConflictCheckOptions {
  spaceId: string;
  teacherId: string;
  startDatetime: Date;
  endDatetime: Date;
  excludeBookingId?: string;  // for updates — exclude self
}

export interface ConflictResult {
  hasConflict: boolean;
  reason?: string;
}

/**
 * Check for space overlap (same space, overlapping time, not cancelled).
 * Any active booking in the same space at the same time is a conflict.
 */
export async function checkSpaceConflict(opts: ConflictCheckOptions): Promise<ConflictResult> {
  const { spaceId, startDatetime, endDatetime, excludeBookingId } = opts;

  const conflict = await prisma.booking.findFirst({
    where: {
      spaceId,
      status: { notIn: ["CANCELLED"] },
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      startDatetime: { lt: endDatetime },
      endDatetime:   { gt: startDatetime },
    },
    include: {
      teacher: { include: { user: { select: { name: true } } } },
    },
  });

  if (!conflict) return { hasConflict: false };

  const start = conflict.startDatetime.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const end   = conflict.endDatetime.toLocaleTimeString("es-ES",   { hour: "2-digit", minute: "2-digit" });
  const date  = conflict.startDatetime.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });

  return {
    hasConflict: true,
    reason: `El espacio ya está ocupado el ${date} de ${start} a ${end} por ${conflict.teacher.user.name}`,
  };
}

/**
 * Check for teacher overlap (same teacher, overlapping time, not cancelled).
 */
export async function checkTeacherConflict(opts: ConflictCheckOptions): Promise<ConflictResult> {
  const { teacherId, startDatetime, endDatetime, excludeBookingId } = opts;

  const conflict = await prisma.booking.findFirst({
    where: {
      teacherId,
      status: { notIn: ["CANCELLED"] },
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      startDatetime: { lt: endDatetime },
      endDatetime:   { gt: startDatetime },
    },
    include: {
      space: { select: { name: true } },
    },
  });

  if (!conflict) return { hasConflict: false };

  const start = conflict.startDatetime.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const end   = conflict.endDatetime.toLocaleTimeString("es-ES",   { hour: "2-digit", minute: "2-digit" });
  const date  = conflict.startDatetime.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });

  return {
    hasConflict: true,
    reason: `El profesor ya tiene una sesión el ${date} de ${start} a ${end} en ${conflict.space.name}`,
  };
}

/**
 * Run both checks and return the first conflict found.
 */
export async function checkBookingConflicts(opts: ConflictCheckOptions): Promise<ConflictResult> {
  const [spaceConflict, teacherConflict] = await Promise.all([
    checkSpaceConflict(opts),
    checkTeacherConflict(opts),
  ]);

  if (spaceConflict.hasConflict) return spaceConflict;
  if (teacherConflict.hasConflict) return teacherConflict;
  return { hasConflict: false };
}
