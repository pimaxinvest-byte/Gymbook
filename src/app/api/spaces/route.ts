import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const spaces = await prisma.space.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return NextResponse.json(spaces);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { name, description, capacity } = await req.json();
  const space = await prisma.space.create({ data: { name, description, capacity: capacity || 1 } });
  return NextResponse.json(space, { status: 201 });
}
