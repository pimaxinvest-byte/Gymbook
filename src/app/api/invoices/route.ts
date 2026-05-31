import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const itemSchema = z.object({
  description: z.string(),
  qty:         z.number().min(1),
  unitPrice:   z.number().min(0),
  total:       z.number().min(0),
});

const createSchema = z.object({
  teacherId:      z.string().optional(), // admin can pass this; teacher gets it from session
  clientId:       z.string(),
  type:           z.enum(["TICKET", "INVOICE"]),
  items:          z.array(itemSchema).min(1),
  taxRate:        z.number().min(0).max(100).default(0),
  notes:          z.string().optional(),
  creditPackageId: z.string().optional(),
  clientNif:      z.string().optional(),
  date:           z.string().optional(), // ISO date string
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  let billingSettingsId: string | undefined;

  if (session.user.role === "ADMIN") {
    const teacherId = searchParams.get("teacherId");
    if (teacherId) {
      const bs = await prisma.teacherBillingSettings.findUnique({ where: { teacherId } });
      billingSettingsId = bs?.id;
    }
  } else {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json([], { status: 200 });
    const bs = await prisma.teacherBillingSettings.findUnique({ where: { teacherId: teacher.id } });
    billingSettingsId = bs?.id;
  }

  const invoices = await prisma.invoice.findMany({
    where: billingSettingsId ? { billingSettingsId } : undefined,
    orderBy: { date: "desc" },
    take: 100,
  });

  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["ADMIN", "TEACHER"].includes(session.user.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const data = createSchema.parse(body);

  // Resolve teacher
  let teacherId: string;
  if (session.user.role === "ADMIN" && data.teacherId) {
    teacherId = data.teacherId;
  } else {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.user.id } });
    if (!teacher) return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    teacherId = teacher.id;
  }

  // Get billing settings
  const billing = await prisma.teacherBillingSettings.findUnique({ where: { teacherId } });
  if (!billing) return NextResponse.json({ error: "Configura los datos de facturación primero" }, { status: 400 });
  if (!billing.issueDocuments) return NextResponse.json({ error: "La emisión de documentos no está activada" }, { status: 400 });

  // Get client
  const client = await prisma.user.findUnique({ where: { id: data.clientId }, select: { name: true, email: true } });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Increment counter + generate number
  const isInvoice = data.type === "INVOICE";
  const updated = await prisma.teacherBillingSettings.update({
    where: { id: billing.id },
    data:  isInvoice
      ? { lastInvoiceNum: { increment: 1 } }
      : { lastTicketNum:  { increment: 1 } },
  });

  const num    = isInvoice ? updated.lastInvoiceNum : updated.lastTicketNum;
  const prefix = isInvoice ? billing.invoicePrefix   : billing.ticketPrefix;
  const year   = new Date().getFullYear();
  const number = `${prefix}-${year}-${String(num).padStart(3, "0")}`;

  // Calculate totals
  const subtotal  = data.items.reduce((s, i) => s + i.total, 0);
  const taxAmount = Math.round(subtotal * (data.taxRate / 100) * 100) / 100;
  const total     = Math.round((subtotal + taxAmount) * 100) / 100;

  const invoice = await prisma.invoice.create({
    data: {
      number,
      type:             data.type,
      billingSettingsId: billing.id,
      teacherName:       billing.businessName || "—",
      teacherNif:        billing.nif ?? undefined,
      teacherAddress:    billing.address ?? undefined,
      clientName:        client.name || "—",
      clientEmail:       client.email ?? undefined,
      clientNif:         data.clientNif ?? undefined,
      items:             data.items,
      subtotal,
      taxRate:           data.taxRate,
      taxAmount,
      total,
      date:              data.date ? new Date(data.date) : new Date(),
      creditPackageId:   data.creditPackageId ?? undefined,
      notes:             data.notes ?? undefined,
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}
