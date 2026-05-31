import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_SIZE_BYTES = 600_000; // ~600 KB base64 limit

// POST /api/upload — upload avatar for a user
// Body: { userId?, base64 }  — userId only for ADMIN; otherwise updates own account
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { base64, userId } = body;

  if (!base64 || typeof base64 !== "string") {
    return NextResponse.json({ error: "base64 image is required" }, { status: 400 });
  }

  // Validate base64 size
  const sizeBytes = Buffer.byteLength(base64, "base64");
  if (sizeBytes > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "La imagen es demasiado grande (máx 600 KB)" }, { status: 413 });
  }

  // Determine target user
  let targetUserId = session.user.id;
  if (userId && userId !== session.user.id) {
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    targetUserId = userId;
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { avatarUrl: base64 },
    select: { id: true, avatarUrl: true },
  });

  return NextResponse.json(updated);
}
