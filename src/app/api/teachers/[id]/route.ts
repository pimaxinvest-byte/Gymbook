import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, email, color, bio, specialties, telegramChatId, password } = body;

  const teacher = await prisma.teacher.findUnique({ where: { id }, include: { user: true } });
  if (!teacher) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Update user fields
  const userUpdate: Record<string, unknown> = {};
  if (name)                    userUpdate.name = name;
  if (email)                   userUpdate.email = email;
  if (telegramChatId !== undefined) userUpdate.telegramChatId = telegramChatId;
  if (password) {
    userUpdate.password = await bcrypt.hash(password, 12);
  }

  if (Object.keys(userUpdate).length > 0) {
    await prisma.user.update({ where: { id: teacher.userId }, data: userUpdate });
  }

  const updated = await prisma.teacher.update({
    where: { id },
    data: {
      ...(color      && { color }),
      ...(bio !== undefined && { bio }),
      ...(specialties && { specialties }),
    },
    include: {
      user: { select: { id: true, name: true, email: true, telegramChatId: true, telegramConnected: true, telegramUsername: true, avatarUrl: true } },
      teacherActivities: { include: { activity: { select: { id: true, name: true, color: true } } } },
    },
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
