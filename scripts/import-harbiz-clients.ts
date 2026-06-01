/**
 * import-harbiz-clients.ts — import all Harbiz clients into GymBook DB
 * npx tsx scripts/import-harbiz-clients.ts
 *
 * SECURITY: no PII in console output.
 */

import { PrismaClient } from "@prisma/client";
import { createHash, createDecipheriv, randomBytes } from "crypto";
import WebSocket from "ws";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SimpleDDPCtor = require("simpleddp");

const HARBIZ_WS  = "wss://app.harbiz.io/websocket";
const TEACHER_ID = "cmptnd84i0007bj0pnej7tvwk"; // Max Romeo
const PAGE_SIZE  = 100;

// ── Decrypt ───────────────────────────────────────────────────────────────────
function decrypt(enc: string): string {
  const key = createHash("sha256").update(process.env.NEXTAUTH_SECRET!).digest();
  const buf = Buffer.from(enc, "base64");
  const d = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

type DDP = { call(m: string, ...a: unknown[]): Promise<unknown>; connect(): Promise<void>; disconnect(): Promise<void> };

interface HarbizClientRaw {
  _id: string;
  personalData: {
    name?: string;
    surname?: string;
    fullName?: string;
    email?: string;
  };
  subscriptionData?: { status?: string };
  removed?: boolean;
}

async function fetchClients(ddp: DDP, type: "active" | "archived"): Promise<HarbizClientRaw[]> {
  const all: HarbizClientRaw[] = [];
  let skip = 0;
  while (true) {
    const res = await Promise.race([
      ddp.call("professional.clients.getPaginatedClients",
        { limit: PAGE_SIZE, skip }, { clientType: type }, false),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 25000)),
    ]) as { clients?: HarbizClientRaw[] };

    const page = res?.clients ?? [];
    if (!page.length) break;
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient();

async function main() {
  // Load credentials
  const conn = await prisma.teacherHarbizConnection.findUnique({ where: { teacherId: TEACHER_ID } });
  if (!conn?.harbizEmail || !conn.harbizPasswordEncrypted) throw new Error("No credentials");
  const email    = conn.harbizEmail;
  const password = decrypt(conn.harbizPasswordEncrypted);

  // Connect DDP
  console.log("⏳ Connecting to Harbiz...");
  const ddp = new SimpleDDPCtor({
    endpoint: HARBIZ_WS, SocketConstructor: WebSocket,
    autoConnect: false, autoReconnect: false,
  }) as DDP;
  await Promise.race([
    ddp.connect(),
    new Promise<never>((_, r) => setTimeout(() => r(new Error("connect timeout")), 30000)),
  ]);
  const digest = createHash("sha256").update(password).digest("hex");
  await ddp.call("login", { user: { email }, password: { digest, algorithm: "sha-256" } });
  console.log("✅ Logged in\n");

  try {
    // Fetch active + archived
    const active   = await fetchClients(ddp, "active");
    const archived = await fetchClients(ddp, "archived");
    const all = [...active, ...archived];
    console.log(`📋 Harbiz clients: ${active.length} active + ${archived.length} archived = ${all.length} total\n`);

    let created = 0, linked = 0, skipped = 0, errors = 0;

    for (const hc of all) {
      const harbizId = hc._id;
      const pd = hc.personalData ?? {};

      // Build name
      const name = (pd.fullName?.trim() ||
        [pd.name, pd.surname].filter(Boolean).join(" ").trim());

      const clientEmail = pd.email?.trim().toLowerCase();

      if (!name || !clientEmail) {
        skipped++;
        continue;
      }

      const isActive = !hc.removed && hc.subscriptionData?.status !== "archived";

      try {
        // Already mapped?
        const existing = await prisma.externalIdMapping.findUnique({
          where: { entityType_externalId_source: { entityType: "CLIENT", externalId: harbizId, source: "HARBIZ" } },
        });
        if (existing) {
          // Sync name
          await prisma.user.update({ where: { id: existing.gymBookId }, data: { name } });
          linked++;
          continue;
        }

        // Match by email
        const byEmail = await prisma.user.findUnique({ where: { email: clientEmail }, select: { id: true } });

        if (byEmail) {
          await prisma.$transaction(async (tx) => {
            let client = await tx.client.findUnique({ where: { userId: byEmail.id } });
            if (!client) {
              client = await tx.client.create({
                data: { userId: byEmail.id, status: isActive ? "ACTIVE" : "SUSPENDED", preferredTeacherId: TEACHER_ID },
              });
            }
            await tx.clientTeacher.upsert({
              where: { clientId_teacherId: { clientId: client.id, teacherId: TEACHER_ID } },
              create: { clientId: client.id, teacherId: TEACHER_ID },
              update: {},
            });
            await tx.externalIdMapping.create({
              data: { entityType: "CLIENT", gymBookId: byEmail.id, externalId: harbizId, source: "HARBIZ" },
            });
          });
          linked++;
        } else {
          // Create new
          await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: {
                name,
                email: clientEmail,
                password: "$harbiz$" + randomBytes(16).toString("hex"),
                role: "CLIENT",
              },
            });
            const client = await tx.client.create({
              data: { userId: user.id, status: isActive ? "ACTIVE" : "SUSPENDED", preferredTeacherId: TEACHER_ID },
            });
            await tx.clientTeacher.create({ data: { clientId: client.id, teacherId: TEACHER_ID } });
            await tx.externalIdMapping.create({
              data: { entityType: "CLIENT", gymBookId: user.id, externalId: harbizId, source: "HARBIZ" },
            });
          });
          created++;
        }
      } catch (e) {
        console.error(`  ⚠ ${harbizId.slice(0,8)}…: ${e instanceof Error ? e.message : String(e)}`);
        errors++;
      }
    }

    console.log("══════════════════════════════════");
    console.log(`✅ Created new   : ${created}`);
    console.log(`🔗 Linked/updated: ${linked}`);
    console.log(`⏭  Skipped (no email/name): ${skipped}`);
    console.log(`❌ Errors        : ${errors}`);
    console.log("══════════════════════════════════");

  } finally {
    await ddp.disconnect().catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
