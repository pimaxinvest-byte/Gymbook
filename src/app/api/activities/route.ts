import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const activities = await prisma.activity.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return NextResponse.json(activities);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { name, description, defaultDuration, maxCapacity, color } = await req.json();
  const activity = await prisma.activity.create({
    data: { name, description, defaultDuration: defaultDuration || 60, maxCapacity: maxCapacity || 1, color },
  });
  return NextResponse.json(activity, { status: 201 });
}
