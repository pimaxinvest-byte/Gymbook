import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, email, color, bio, specialties, telegramChatId } = body;

  const teacher = await prisma.teacher.findUnique({ where: { id }, include: { user: true } });
  if (!teacher) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (name || email || telegramChatId !== undefined) {
    await prisma.user.update({
      where: { id: teacher.userId },
      data: { ...(name && { name }), ...(email && { email }), ...(telegramChatId !== undefined && { telegramChatId }) },
    });
  }

  const updated = await prisma.teacher.update({
    where: { id },
    data: {
      ...(color && { color }),
      ...(bio !== undefined && { bio }),
      ...(specialties && { specialties }),
    },
    include: { user: { select: { id: true, name: true, email: true, telegramChatId: true } } },
  });

  // Update color on future bookings
  if (color) {
    await prisma.booking.updateMany({
      where: { teacherId: id, startDatetime: { gte: new Date() } },
      data: { color },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const teacher = await prisma.teacher.findUnique({ where: { id } });
  if (!teacher) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.user.delete({ where: { id: teacher.userId } });
  return NextResponse.json({ success: true });
}
