import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/credits?clientId=...&teacherId=...
// Returns credit balance(s). TEACHER sees their own clients; ADMIN sees all; CLIENT sees their own.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const teacherId = searchParams.get("teacherId");

  const role = session.user.role;
  const userId = session.user.id;

  // Build where clause based on role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (role === "CLIENT") {
    const client = await prisma.client.findUnique({ where: { userId } });
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    where.clientId = client.id;
  } else if (role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    where.teacherId = teacher.id;
    if (clientId) where.clientId = clientId;
  } else {
    // ADMIN — can filter by either
    if (clientId) where.clientId = clientId;
    if (teacherId) where.teacherId = teacherId;
  }

  const credits = await prisma.clientCredits.findMany({
    where,
    include: {
      client: { include: { user: { select: { id: true, name: true, email: true } } } },
      teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(credits);
}

// POST /api/credits — assign credits (TEACHER or ADMIN only)
// Body: { clientId, teacherId?, amount, note? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { clientId, teacherId, amount, note } = body;

  if (!clientId || typeof amount !== "number" || amount === 0) {
    return NextResponse.json({ error: "clientId and non-zero amount are required" }, { status: 400 });
  }

  // Determine the teacher
  let resolvedTeacherId = teacherId;
  if (role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    resolvedTeacherId = teacher.id;
  }

  if (!resolvedTeacherId) {
    return NextResponse.json({ error: "teacherId is required for ADMIN" }, { status: 400 });
  }

  // Upsert ClientCredits row + create transaction atomically
  const result = await prisma.$transaction(async (tx) => {
    const credits = await tx.clientCredits.upsert({
      where: { clientId_teacherId: { clientId, teacherId: resolvedTeacherId } },
      create: { clientId, teacherId: resolvedTeacherId, balance: 0 },
      update: {},
    });

    const newBalance = credits.balance + amount;
    if (newBalance < 0) throw new Error("Insufficient credits");

    const updated = await tx.clientCredits.update({
      where: { id: credits.id },
      data: { balance: newBalance },
    });

    await tx.creditTransaction.create({
      data: {
        clientCreditsId: credits.id,
        amount,
        type: amount > 0 ? "ASSIGNED" : "DEDUCTED",
        note: note ?? null,
        createdById: session.user.id,
      },
    });

    return updated;
  });

  return NextResponse.json(result, { status: 201 });
}
