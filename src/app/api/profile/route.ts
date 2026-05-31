import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/profile — current user's profile (avatarUrl, telegramChatId)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true, telegramChatId: true, name: true, email: true },
  });

  return NextResponse.json(user || {});
}

// PATCH /api/profile — update own profile
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { telegramChatId, name } = body;

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(name ? { name } : {}),
      ...(telegramChatId !== undefined ? { telegramChatId: telegramChatId || null } : {}),
    },
    select: { name: true, email: true, avatarUrl: true, telegramChatId: true },
  });

  return NextResponse.json(updated);
}
