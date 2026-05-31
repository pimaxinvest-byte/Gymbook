import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreditType } from "@prisma/client";

// GET /api/credits?clientId=...&teacherId=...&creditType=...
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId");
  const teacherId = searchParams.get("teacherId");
  const creditType = searchParams.get("creditType") as CreditType | null;

  const role = session.user.role;
  const userId = session.user.id;

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
    if (clientId) where.clientId = clientId;
    if (teacherId) where.teacherId = teacherId;
  }

  if (creditType) where.creditType = creditType;

  const credits = await prisma.clientCredits.findMany({
    where,
    include: {
      client: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, telegramChatId: true } } } },
      teacher: { include: { user: { select: { id: true, name: true, email: true } } } },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { createdBy: { select: { name: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Mark expired
  const now = new Date();
  const enriched = credits.map((c) => ({
    ...c,
    isExpired: c.expiresAt ? c.expiresAt < now : false,
  }));

  return NextResponse.json(enriched);
}

// POST /api/credits — assign credits (TEACHER or ADMIN)
// Body: { clientId, teacherId?, creditType?, amount, note? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { clientId, teacherId, amount, note, creditType = "INDIVIDUAL" } = body;

  if (!clientId || typeof amount !== "number" || amount === 0) {
    return NextResponse.json({ error: "clientId and non-zero amount are required" }, { status: 400 });
  }

  // Determine teacher
  let resolvedTeacherId = teacherId;
  if (role === "TEACHER") {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    resolvedTeacherId = teacher.id;
  }
  if (!resolvedTeacherId) {
    return NextResponse.json({ error: "teacherId is required for ADMIN" }, { status: 400 });
  }

  // Get credit expiry setting
  const settings = await prisma.appSettings.findFirst();
  const expiryMonths = settings?.creditExpiryMonths ?? 6;
  const expiresAt = amount > 0
    ? new Date(Date.now() + expiryMonths * 30 * 24 * 60 * 60 * 1000)
    : undefined;

  const result = await prisma.$transaction(async (tx) => {
    const credits = await tx.clientCredits.upsert({
      where: {
        clientId_teacherId_creditType: {
          clientId,
          teacherId: resolvedTeacherId,
          creditType: creditType as CreditType,
        },
      },
      create: {
        clientId,
        teacherId: resolvedTeacherId,
        creditType: creditType as CreditType,
        balance: 0,
        expiresAt: amount > 0 ? expiresAt : null,
      },
      update: {},
    });

    const newBalance = credits.balance + amount;
    if (newBalance < 0) throw new Error("Insufficient credits");

    const updated = await tx.clientCredits.update({
      where: { id: credits.id },
      data: {
        balance: newBalance,
        ...(amount > 0 && expiresAt ? { expiresAt } : {}),
      },
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
