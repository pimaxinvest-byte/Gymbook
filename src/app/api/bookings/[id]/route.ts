import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyBookingCancelled, notifyBookingModified } from "@/lib/telegram";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      teacher: { include: { user: { select: { name: true, avatarUrl: true, telegramChatId: true } } } },
      client: { include: { user: { select: { name: true, avatarUrl: true } } } },
      activity: { select: { name: true } },
      space: { select: { name: true } },
      participants: { include: { client: { include: { user: { select: { name: true, avatarUrl: true } } } } } },
    },
  });

  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(booking);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      teacher: { include: { user: true } },
      client: { include: { user: true } },
      activity: true,
      space: true,
    },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Permissions
  if (session.user.role === "CLIENT") {
    const client = await prisma.client.findUnique({ where: { userId: session.user.id } });
    if (booking.clientId !== client?.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (body.status !== "CANCELLED") {
      return NextResponse.json({ error: "Clients can only cancel" }, { status: 403 });
    }
  }

  const isCancelling = body.status === "CANCELLED" && booking.status === "BOOKED";
  let updated;

  if (isCancelling && booking.clientId) {
    // Load cancellation policy
    const settings = await prisma.appSettings.findFirst();
    const hoursLimit = settings?.cancellationHoursLimit ?? 24;
    const refundCredits = settings?.cancellationRefundCredits ?? true;

    const hoursUntilStart = (booking.startDatetime.getTime() - Date.now()) / 3_600_000;
    const cancelledInTime = hoursUntilStart >= hoursLimit;

    const isSGT = booking.sessionType === "SGT";
    const creditType = isSGT ? "SGT" : "INDIVIDUAL";

    const creditRecord = await prisma.clientCredits.findUnique({
      where: {
        clientId_teacherId_creditType: {
          clientId: booking.clientId,
          teacherId: booking.teacherId,
          creditType,
        },
      },
    });

    if (creditRecord && refundCredits && cancelledInTime) {
      // Refund credit
      updated = await prisma.$transaction(async (tx) => {
        const result = await tx.booking.update({ where: { id }, data: body });

        const balanceBefore = creditRecord.balance;

        await tx.clientCredits.update({
          where: { id: creditRecord.id },
          data: { balance: { increment: 1 } },
        });

        await tx.creditTransaction.create({
          data: {
            clientCreditsId: creditRecord.id,
            amount: 1,
            type: "REFUNDED",
            bookingId: id,
            note: `Cancelación a tiempo de ${booking.activity.name}`,
            createdById: session.user.id,
          },
        });

        await tx.creditLog.create({
          data: {
            clientCreditsId: creditRecord.id,
            clientId: booking.clientId!,
            actionType: "CREDIT_RESTORED",
            previousValueJson: { balance: balanceBefore },
            newValueJson: { balance: balanceBefore + 1 },
            amount: 1,
            performedById: session.user.id,
            bookingId: id,
            notes: `Crédito restaurado por cancelación a tiempo de ${booking.activity.name}`,
          },
        });

        return result;
      });
    } else {
      // No refund (too late or policy says no)
      updated = await prisma.booking.update({ where: { id }, data: body });

      if (creditRecord && !cancelledInTime) {
        // Log as non-refunded
        await prisma.creditTransaction.create({
          data: {
            clientCreditsId: creditRecord.id,
            amount: 0,
            type: "DEDUCTED",
            bookingId: id,
            note: `Cancelación tardía — sin reembolso de crédito`,
            createdById: session.user.id,
          },
        });
      }
    }
  } else {
    updated = await prisma.booking.update({ where: { id }, data: body });
  }

  const notifData = {
    bookingId: id,
    teacherName: booking.teacher.user.name,
    clientName: booking.client?.user.name,
    activityName: booking.activity.name,
    spaceName: booking.space.name,
    startDatetime: booking.startDatetime,
    endDatetime: booking.endDatetime,
    status: updated.status,
    notes: booking.notes || undefined,
  };

  if (body.status === "CANCELLED") {
    notifyBookingCancelled(
      notifData,
      booking.teacher.user.telegramChatId || undefined,
      booking.client?.user.telegramChatId || undefined
    ).catch(console.error);
  } else {
    notifyBookingModified(
      notifData,
      booking.teacher.user.telegramChatId || undefined,
      booking.client?.user.telegramChatId || undefined
    ).catch(console.error);
  }

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.booking.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
