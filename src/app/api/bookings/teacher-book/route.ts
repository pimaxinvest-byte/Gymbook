import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { notifyBookingCreated } from "@/lib/telegram";
import { CreditType } from "@prisma/client";
import { checkBookingConflicts } from "@/lib/booking-conflicts";

const schema = z.object({
  bookingId: z.string(),
  clientId:  z.string(),
});

/**
 * POST /api/bookings/teacher-book
 * Allows a TEACHER or ADMIN to book an AVAILABLE slot on behalf of a client.
 * Validates credit balance, deducts 1 credit, and sends Telegram notifications.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["TEACHER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { bookingId, clientId } = schema.parse(body);

  // Resolve teacher record
  let teacherRecord: { id: string; user: { name: string; telegramChatId: string | null } } | null = null;
  if (session.user.role === "TEACHER") {
    teacherRecord = await prisma.teacher.findUnique({
      where: { userId: session.user.id },
      include: { user: { select: { name: true, telegramChatId: true } } },
    });
    if (!teacherRecord) {
      return NextResponse.json({ error: "Perfil de entrenador no encontrado" }, { status: 404 });
    }
  }

  // Load booking with full context
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      teacher: { include: { user: { select: { name: true, telegramChatId: true } } } },
      activity: { select: { name: true } },
      space: { select: { name: true } },
      participants: true,
    },
  });
  if (!booking) return NextResponse.json({ error: "Franja no encontrada" }, { status: 404 });
  if (booking.status !== "AVAILABLE") {
    return NextResponse.json({ error: "Esta franja ya no está disponible" }, { status: 409 });
  }

  // TEACHER role: must own the booking
  if (session.user.role === "TEACHER" && booking.teacherId !== teacherRecord!.id) {
    return NextResponse.json({ error: "No puedes reservar para franjas de otro entrenador" }, { status: 403 });
  }

  // Resolve client
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { user: { select: { name: true, telegramChatId: true } } },
  });
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

  // Validate client is assigned to this booking's teacher
  const assignment = await prisma.clientTeacher.findUnique({
    where: {
      clientId_teacherId: { clientId: client.id, teacherId: booking.teacherId },
    },
  });
  if (!assignment) {
    return NextResponse.json(
      { error: "El cliente no está asignado a este entrenador" },
      { status: 403 }
    );
  }

  // Space + teacher conflict check (safety net — excludes the slot itself)
  const conflictCheck = await checkBookingConflicts({
    spaceId:       booking.spaceId,
    teacherId:     booking.teacherId,
    startDatetime: booking.startDatetime,
    endDatetime:   booking.endDatetime,
    excludeBookingId: booking.id,
  });
  if (conflictCheck.hasConflict) {
    return NextResponse.json({ error: conflictCheck.reason }, { status: 409 });
  }

  // Client double-booking check: ensure client has no overlapping confirmed session
  const clientConflict = await prisma.booking.findFirst({
    where: {
      status: { in: ["BOOKED"] },
      startDatetime: { lt: booking.endDatetime },
      endDatetime:   { gt: booking.startDatetime },
      OR: [
        { clientId: client.id },
        { participants: { some: { clientId: client.id } } },
      ],
    },
  });
  if (clientConflict) {
    return NextResponse.json(
      { error: "El cliente ya tiene una sesión a esa hora" },
      { status: 409 }
    );
  }

  // Credit check
  const isSGT = booking.sessionType === "SGT";
  const creditType: CreditType = isSGT ? "SGT" : "INDIVIDUAL";
  const now = new Date();

  const creditRecord = await prisma.clientCredits.findUnique({
    where: {
      clientId_teacherId_creditType: {
        clientId: client.id,
        teacherId: booking.teacherId,
        creditType,
      },
    },
  });

  const balance = creditRecord?.balance ?? 0;
  const isExpired = creditRecord?.expiresAt ? creditRecord.expiresAt < now : false;

  if (balance < 1 || isExpired) {
    const msg = isExpired
      ? `Los créditos ${isSGT ? "SGT " : ""}del cliente han caducado`
      : `El cliente no tiene créditos ${isSGT ? "SGT " : ""}suficientes con este entrenador`;
    return NextResponse.json({ error: msg }, { status: 402 });
  }

  // For SGT: check capacity and not already joined
  if (isSGT) {
    if (booking.participants.length >= booking.capacity) {
      return NextResponse.json({ error: "El grupo está lleno" }, { status: 409 });
    }
    const alreadyJoined = booking.participants.some((p) => p.clientId === client.id);
    if (alreadyJoined) {
      return NextResponse.json({ error: "El cliente ya está apuntado a esta sesión" }, { status: 409 });
    }
  }

  // Atomic: book + deduct credit
  await prisma.$transaction(async (tx) => {
    if (isSGT) {
      await tx.bookingParticipant.create({ data: { bookingId, clientId: client.id } });
      const newCount = booking.participants.length + 1;
      if (newCount >= booking.capacity) {
        await tx.booking.update({ where: { id: bookingId }, data: { status: "BOOKED" } });
      }
    } else {
      await tx.booking.update({
        where: { id: bookingId },
        data: { clientId: client.id, status: "BOOKED" },
      });
    }

    await tx.clientCredits.update({
      where: { id: creditRecord!.id },
      data: { balance: { decrement: 1 } },
    });

    await tx.creditTransaction.create({
      data: {
        clientCreditsId: creditRecord!.id,
        amount: -1,
        type: "DEDUCTED",
        bookingId,
        note: `Reserva ${booking.activity.name} con ${booking.teacher.user.name}${isSGT ? " (SGT)" : ""} — asignada por entrenador`,
        createdById: session.user.id,
      },
    });
  });

  // Telegram notifications (non-blocking)
  notifyBookingCreated(
    {
      bookingId: booking.id,
      teacherName: booking.teacher.user.name,
      clientName: client.user.name,
      activityName: booking.activity.name,
      spaceName: booking.space.name,
      startDatetime: booking.startDatetime,
      endDatetime: booking.endDatetime,
      status: "BOOKED",
    },
    booking.teacher.user.telegramChatId || undefined,
    client.user.telegramChatId || undefined
  ).catch(console.error);

  return NextResponse.json({ success: true }, { status: 200 });
}
