import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let settings = await prisma.telegramSettings.findFirst();
  if (!settings) settings = await prisma.telegramSettings.create({ data: {} });

  // Mask token
  const masked = settings.botToken
    ? settings.botToken.slice(0, 8) + "..." + settings.botToken.slice(-4)
    : null;

  return NextResponse.json({ ...settings, botToken: masked });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  let settings = await prisma.telegramSettings.findFirst();

  if (settings) {
    settings = await prisma.telegramSettings.update({ where: { id: settings.id }, data: body });
  } else {
    settings = await prisma.telegramSettings.create({ data: body });
  }

  return NextResponse.json({ success: true });
}
