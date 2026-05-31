import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, PaymentMethod, CreditLogAction } from "@prisma/client";

// PATCH /api/credits/[id]/payment — update payment status for a credit package
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role === "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { paymentStatus, amountPaid, paymentMethod, paymentDate, notes } = body;

  // Validate paymentStatus
  if (!paymentStatus || !["PAID", "UNPAID", "PARTIAL"].includes(paymentStatus)) {
    return NextResponse.json(
      { error: "paymentStatus must be PAID, UNPAID, or PARTIAL" },
      { status: 400 }
    );
  }

  if (paymentStatus === "PAID" && (amountPaid === undefined || amountPaid === null)) {
    return NextResponse.json(
      { error: "amountPaid is required when paymentStatus is PAID" },
      { status: 400 }
    );
  }

  // Find the credit package
  const creditRecord = await prisma.clientCredits.findUnique({
    where: { id },
    include: { teacher: { select: { userId: true } } },
  });

  if (!creditRecord) {
    return NextResponse.json({ error: "Credit package not found" }, { status: 404 });
  }

  // Authorization: TEACHER must own the record; ADMIN can access all
  if (role === "TEACHER") {
    if (creditRecord.teacher?.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Determine action type
  const actionTypeMap: Record<string, CreditLogAction> = {
    PAID: "MARKED_PAID",
    UNPAID: "MARKED_UNPAID",
    PARTIAL: "PARTIALLY_PAID",
  };
  const actionType = actionTypeMap[paymentStatus];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {
    paymentStatus: paymentStatus as PaymentStatus,
  };
  if (amountPaid !== undefined) updateData.amountPaid = amountPaid;
  if (paymentMethod) updateData.paymentMethod = paymentMethod as PaymentMethod;
  if (paymentDate) updateData.paymentDate = new Date(paymentDate);
  if (notes !== undefined) updateData.notes = notes;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.clientCredits.update({
      where: { id },
      data: updateData,
    });

    await tx.creditLog.create({
      data: {
        clientCreditsId: id,
        clientId: creditRecord.clientId,
        actionType,
        previousValueJson: {
          paymentStatus: creditRecord.paymentStatus,
          amountPaid: creditRecord.amountPaid,
        },
        newValueJson: {
          paymentStatus: paymentStatus as PaymentStatus,
          amountPaid: amountPaid ?? creditRecord.amountPaid,
        },
        performedById: session.user.id,
        notes: notes ?? null,
      },
    });

    return result;
  });

  return NextResponse.json(updated);
}
