import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET /api/profile — current user's profile
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name:              true,
      email:             true,
      avatarUrl:         true,
      telegramChatId:    true,
      telegramUsername:  true,
      telegramPhone:     true,
      telegramConnected: true,
    },
  });

  return NextResponse.json(user || {});
}

// PATCH /api/profile — update own profile (name, telegramChatId, password)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { telegramChatId, name, password } = body;

  const data: Record<string, unknown> = {};
  if (name)                    data.name = name;
  if (telegramChatId !== undefined) data.telegramChatId = telegramChatId || null;
  if (password && password.length >= 6) {
    data.password = await bcrypt.hash(password, 12);
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      name:              true,
      email:             true,
      avatarUrl:         true,
      telegramChatId:    true,
      telegramUsername:  true,
      telegramConnected: true,
    },
  });

  return NextResponse.json(updated);
}
