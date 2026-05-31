import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  businessName:   z.string().optional(),
  nif:            z.string().optional(),
  address:        z.string().optional(),
  city:           z.string().optional(),
  postalCode:     z.string().optional(),
  phone:          z.string().optional(),
  email:          z.string().email().optional().or(z.literal("")),
  issueDocuments: z.boolean().optional(),
  documentType:   z.enum(["TICKET", "INVOICE"]).optional(),
  invoicePrefix:  z.string().max(10).optional(),
  ticketPrefix:   z.string().max(10).optional(),
  footerNote:     z.string().optional(),
});

async function resolveTeacherId(user: { id: string; role: string }, teacherIdParam?: string | null): Promise<string | null> {
  if (user.role === "ADMIN" && teacherIdParam) return teacherIdParam;
  const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
  return teacher?.id ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const teacherId = await resolveTeacherId(session.user, searchParams.get("teacherId"));
  if (!teacherId) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

  const settings = await prisma.teacherBillingSettings.findUnique({ where: { teacherId } });
  return NextResponse.json(settings ?? {});
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || !["ADMIN", "TEACHER"].includes(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const teacherId = await resolveTeacherId(session.user, searchParams.get("teacherId"));
  if (!teacherId) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });

  const data = schema.parse(await req.json());

  const settings = await prisma.teacherBillingSettings.upsert({
    where:  { teacherId },
    create: { teacherId, ...data },
    update: data,
  });
  return NextResponse.json(settings);
}
