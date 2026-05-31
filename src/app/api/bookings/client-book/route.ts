import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { notifyBookingCreated } from "@/lib/telegram";
import { CreditType } from "@prisma/client";

const schema = z.object({
  bookingId: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { bookingId } = schema.parse(body);

  const client = await prisma.client.findUnique({
    where: { userId: session.user.id },
    include: { user: { select: { name: true, telegramChatId: true } } },
  });
  if (!client) return NextResponse.json({ error: "Client profile not found" }, { status: 404 });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      teacher: { include: { user: { select: { name: true, telegramChatId: true } } } },
      activity: { select: { name: true } },
      space: { select: { name: true } },
      participants: true,
    },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status !== "AVAILABLE") {
    return NextResponse.json({ error: "Esta franja no está disponible" }, { status: 409 });
  }

  const isSGT = booking.sessionType === "SGT";
  const creditType: CreditType = isSGT ? "SGT" : "INDIVIDUAL";

  // For SGT: check capacity and not already joined
  if (isSGT) {
    if (booking.participants.length >= booking.capacity) {
      return NextResponse.json({ error: "El grupo está lleno" }, { status: 409 });
    }
    const alreadyJoined = booking.participants.some((p) => p.clientId === client.id);
    if (alreadyJoined) {
      return NextResponse.json({ error: "Ya estás apuntado a esta sesión" }, { status: 409 });
    }
  }

  // Check client is assigned to this teacher
  const assignment = await prisma.clientTeacher.findUnique({
    where: { clientId_teacherId: { clientId: client.id, teacherId: booking.teacherId } },
  });
  if (!assignment) {
    return NextResponse.json(
      { error: "No estás asignado a este entrenador" },
      { status: 403 }
    );
  }

  // Client double-booking check
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
      { error: "Ya tienes una sesión a esa hora" },
      { status: 409 }
    );
  }

  // Credit check
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
      ? `Tus créditos ${isSGT ? "SGT " : ""}han caducado`
      : `No tienes créditos ${isSGT ? "SGT " : ""}suficientes con este entrenador`;
    return NextResponse.json({ error: msg }, { status: 402 });
  }

  // Atomic: book + deduct credit
  const updated = await prisma.$transaction(async (tx) => {
    let result;

    if (isSGT) {
      // Add participant; if full, mark as BOOKED
      await tx.bookingParticipant.create({ data: { bookingId, clientId: client.id } });
      const newCount = booking.participants.length + 1;
      result = await tx.booking.update({
        where: { id: bookingId },
        data: newCount >= booking.capacity ? { status: "BOOKED" } : {},
      });
    } else {
      result = await tx.booking.update({
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
        note: `Reserva ${booking.activity.name} con ${booking.teacher.user.name}${isSGT ? " (SGT)" : ""}`,
        createdById: session.user.id,
      },
    });

    const oldBalance = creditRecord!.balance;
    await tx.creditLog.create({
      data: {
        clientCreditsId: creditRecord!.id,
        clientId: client.id,
        actionType: "CREDIT_USED",
        previousValueJson: { balance: oldBalance },
        newValueJson: { balance: oldBalance - 1 },
        amount: -1,
        performedById: session.user.id,
        bookingId: result.id,
        notes: `Sesión reservada: ${booking.startDatetime.toISOString()}`,
      },
    });

    return result;
  });

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

  return NextResponse.json(updated);
}
