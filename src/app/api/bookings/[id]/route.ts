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
      teacher: { include: { user: { select: { name: true } } } },
      client: { include: { user: { select: { name: true } } } },
      activity: { select: { name: true } },
      space: { select: { name: true } },
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

  const updated = await prisma.booking.update({
    where: { id },
    data: body,
  });

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
    notifyBookingCancelled(notifData, booking.teacher.user.telegramChatId || undefined, booking.client?.user.telegramChatId || undefined).catch(console.error);
  } else {
    notifyBookingModified(notifData, booking.teacher.user.telegramChatId || undefined, booking.client?.user.telegramChatId || undefined).catch(console.error);
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
