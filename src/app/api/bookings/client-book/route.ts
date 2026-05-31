import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { notifyBookingCreated } from "@/lib/telegram";

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
    },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status !== "AVAILABLE") {
    return NextResponse.json({ error: "Esta franja no está disponible" }, { status: 409 });
  }

  // --- Credit check ---
  const creditRecord = await prisma.clientCredits.findUnique({
    where: {
      clientId_teacherId: {
        clientId: client.id,
        teacherId: booking.teacherId,
      },
    },
  });

  const balance = creditRecord?.balance ?? 0;
  if (balance < 1) {
    return NextResponse.json(
      { error: "No tienes créditos suficientes con este entrenador" },
      { status: 402 }
    );
  }

  // --- Atomic: book + deduct credit ---
  const updated = await prisma.$transaction(async (tx) => {
    const bookedEntry = await tx.booking.update({
      where: { id: bookingId },
      data: { clientId: client.id, status: "BOOKED" },
    });

    await tx.clientCredits.update({
      where: { id: creditRecord!.id },
      data: { balance: { decrement: 1 } },
    });

    await tx.creditTransaction.create({
      data: {
        clientCreditsId: creditRecord!.id,
        amount: -1,
        type: "DEDUCTED",
        bookingId: bookingId,
        note: `Reserva ${booking.activity.name} con ${booking.teacher.user.name}`,
        createdById: session.user.id,
      },
    });

    return bookedEntry;
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
