import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/clients — list all clients (TEACHER or ADMIN only)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clients = await prisma.client.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true, telegramChatId: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return NextResponse.json(clients);
}
