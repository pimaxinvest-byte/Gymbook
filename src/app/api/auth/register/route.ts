import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  name:              z.string().min(2),
  lastName:          z.string().optional(),
  email:             z.string().email(),
  password:          z.string().min(6),
  phone:             z.string().optional(),
  telegramUsername:  z.string().optional(),
  goals:             z.string().optional(),
  preferredTeacherId: z.string().optional(),
  acceptedTerms:     z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ error: "Este email ya está registrado" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(data.password, 12);

    // Check if admin approval is required
    const settings = await prisma.appSettings.findFirst();
    const requireApproval = settings?.requireAdminApproval ?? true;

    const user = await prisma.user.create({
      data: {
        name:             data.name,
        email:            data.email,
        password:         hashed,
        role:             "CLIENT",
        telegramUsername: data.telegramUsername || undefined,
      },
    });

    await prisma.client.create({
      data: {
        userId:            user.id,
        status:            requireApproval ? "PENDING" : "ACTIVE",
        lastName:          data.lastName,
        phone:             data.phone,
        goals:             data.goals,
        acceptedTerms:     data.acceptedTerms ?? false,
        preferredTeacherId: data.preferredTeacherId || undefined,
        activatedAt:       requireApproval ? undefined : new Date(),
      },
    });

    // Notify admin via Telegram about new pending registration
    if (requireApproval) {
      const tgSettings = await prisma.telegramSettings.findFirst();
      if (tgSettings?.botToken && tgSettings.notifyAdmin && tgSettings.adminChatId) {
        const msg = `👤 <b>Nuevo cliente pendiente de aprobación</b>\n\nNombre: ${data.name}\nEmail: ${data.email}${data.phone ? `\nTeléfono: ${data.phone}` : ""}${data.goals ? `\nObjetivo: ${data.goals}` : ""}\n\nRevisa el panel admin para aprobar o rechazar.`;
        fetch(`https://api.telegram.org/bot${tgSettings.botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: tgSettings.adminChatId, text: msg, parse_mode: "HTML" }),
        }).catch(console.error);
      }
    }

    return NextResponse.json(
      { success: true, status: requireApproval ? "pending" : "active" },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
