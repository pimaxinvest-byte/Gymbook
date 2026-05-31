import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  name:       z.string().min(1),
  sessions:   z.number().int().min(1).max(100),
  price:      z.number().min(0),
  creditType: z.enum(["INDIVIDUAL", "SGT"]).default("INDIVIDUAL"),
  isActive:   z.boolean().default(true),
  sortOrder:  z.number().int().default(0),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const presets = await prisma.creditPackagePreset.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(presets);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const data = schema.parse(await req.json());
  const preset = await prisma.creditPackagePreset.create({ data });
  return NextResponse.json(preset, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data = schema.partial().parse(rest);
  const preset = await prisma.creditPackagePreset.update({ where: { id }, data });
  return NextResponse.json(preset);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.creditPackagePreset.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
