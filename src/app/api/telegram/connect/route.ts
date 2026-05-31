/**
 * POST /api/telegram/connect
 * Generates a one-time deep link for connecting Telegram to an account.
 * Returns: { url: "https://t.me/BotName?start=user_<userId>_<token>" }
 *
 * The user clicks the link, sends /start to the bot, and the webhook
 * at /api/telegram/webhook saves their chat_id automatically.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Admin can generate link for any userId, otherwise for own account
  let userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  if (session.user.role === "ADMIN" && body.userId) {
    userId = body.userId;
  }

  // Generate a secure one-time token
  const token = crypto.randomBytes(24).toString("hex");

  // Save token to user record (overwrites previous — only latest is valid)
  await prisma.user.update({
    where: { id: userId },
    data:  { telegramToken: token },
  });

  // Get bot name from TelegramSettings
  const settings = await prisma.telegramSettings.findFirst();
  const botName = settings?.botName || process.env.TELEGRAM_BOT_NAME || "GymBookBot";

  const startPayload = `user_${userId}_${token}`;
  const url = `https://t.me/${botName}?start=${startPayload}`;

  return NextResponse.json({ url, botName });
}
