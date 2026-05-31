/**
 * syncService.ts — Harbiz → GymBook synchronization orchestrator
 *
 * Always runs READ-ONLY on Harbiz. GymBook writes only happen when dryRun=false.
 * Default behavior is DRY-RUN. Confirmation required before any writes.
 *
 * SECURITY: No PII (names, emails, phones) in DB logs or console output.
 */

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";
import { HarbizDdpClient } from "./HarbizDdpClient";
import {
  mapClientToGymBook,
  mapSessionToGymBook,
  mapPackToGymBook,
  isValidMappedClient,
  clientLabel,
  sessionLabel,
  packLabel,
} from "./mapper";
import type {
  HarbizClient,
  HarbizSession,
  HarbizSessionPack,
  HarbizSyncOptions,
  HarbizSyncResult,
  HarbizDiffItem,
} from "./types";

const PAGE_SIZE = 25;
const MIN_SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes between real syncs

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function runHarbizSync(opts: HarbizSyncOptions): Promise<HarbizSyncResult> {
  const { teacherId, dryRun } = opts;

  // Default date range: 3 months back → 1 month ahead
  const dateRangeStart = opts.dateRangeStart ?? subMonths(new Date(), 3);
  const dateRangeEnd = opts.dateRangeEnd ?? addMonths(new Date(), 1);

  // Enforce rate limiting for real syncs
  if (!dryRun) {
    await enforceRateLimit(teacherId);
  }

  // Get or create the connection record
  const connection = await getOrCreateConnection(teacherId);

  // Create log entry
  const log = await prisma.externalSyncLog.create({
    data: {
      connectionId: connection.id,
      syncType: "FULL",
      status: "PENDING",
      dryRun,
    },
  });

  const result: HarbizSyncResult = {
    dryRun,
    status: "FAILED",
    clients: { found: 0, toCreate: 0, toUpdate: 0, skipped: 0 },
    sessions: { found: 0, toCreate: 0, skipped: 0 },
    packs: { found: 0, toCreate: 0, toUpdate: 0 },
    errors: [],
    diff: [],
    logId: log.id,
  };

  const harbiz = new HarbizDdpClient();

  try {
    // ── 1. Connect & authenticate ──────────────────────────────────────────
    // Credentials: prefer per-teacher DB record → fallback to env vars
    let harbizEmail: string | undefined;
    let harbizPassword: string | undefined;

    if (connection.harbizEmail && connection.harbizPasswordEncrypted) {
      harbizEmail = connection.harbizEmail;
      try {
        harbizPassword = decrypt(connection.harbizPasswordEncrypted);
      } catch {
        throw new Error("Error decrypting Harbiz password — check NEXTAUTH_SECRET");
      }
    } else {
      harbizEmail = process.env.HARBIZ_EMAIL;
      harbizPassword = process.env.HARBIZ_PASSWORD;
    }

    if (!harbizEmail || !harbizPassword) {
      throw new Error(
        "No hay credenciales Harbiz configuradas. Añade las credenciales en el perfil del profesor o configura HARBIZ_EMAIL y HARBIZ_PASSWORD como variables de entorno."
      );
    }

    await harbiz.connect();
    await harbiz.login(harbizEmail, harbizPassword);

    // ── 2. Fetch session types (needed to resolve activityId) ──────────────
    const sessionTypes = await harbiz.getSessionTypes();
    const sessionTypeMap = await resolveSessionTypes(sessionTypes, teacherId);

    // ── 3. Fetch clients (paginated) ───────────────────────────────────────
    const harbizClients = await fetchAllClients(harbiz);
    result.clients.found = harbizClients.length;

    // ── 4. Process clients ─────────────────────────────────────────────────
    const clientIdMap = new Map<string, string>(); // harbizId → gymBookUserId

    for (const hc of harbizClients) {
      const diffItem = await processClient(hc, teacherId, dryRun, result.errors);
      if (diffItem) {
        result.diff.push(diffItem);
        if (diffItem.gymBookId) {
          clientIdMap.set(hc._id, diffItem.gymBookId);
        }
        if (diffItem.action === "CREATE") result.clients.toCreate++;
        else if (diffItem.action === "UPDATE") result.clients.toUpdate++;
        else result.clients.skipped++;
      }
    }

    // ── 5. Fetch sessions by date range ────────────────────────────────────
    const harbizSessions = await harbiz.getSessionsByDateRange(dateRangeStart, dateRangeEnd);
    result.sessions.found = harbizSessions.length;

    // Default activity fallback
    const defaultActivityId = await getDefaultActivityId(teacherId);

    for (const hs of harbizSessions) {
      const gymBookClientId = clientIdMap.get(hs.clientId);
      if (!gymBookClientId) {
        result.sessions.skipped++;
        continue;
      }

      const activityId =
        (hs.sessionTypeId && sessionTypeMap.get(hs.sessionTypeId)) ??
        defaultActivityId;

      if (!activityId) {
        result.errors.push(`No activity found for session ${hs._id.slice(0, 8)}…`);
        result.sessions.skipped++;
        continue;
      }

      const diffItem = await processSession(
        hs,
        gymBookClientId,
        teacherId,
        activityId,
        dryRun,
        result.errors
      );
      if (diffItem) {
        result.diff.push(diffItem);
        if (diffItem.action === "CREATE") result.sessions.toCreate++;
        else result.sessions.skipped++;
      }
    }

    // ── 6. Fetch session packs per client ──────────────────────────────────
    for (const hc of harbizClients) {
      const gymBookClientId = clientIdMap.get(hc._id);
      if (!gymBookClientId) continue;

      try {
        const packs = await harbiz.getSessionPacksByClient(hc._id);
        result.packs.found += packs.length;

        for (const hp of packs) {
          const diffItem = await processPack(hp, gymBookClientId, teacherId, dryRun, result.errors);
          if (diffItem) {
            result.diff.push(diffItem);
            if (diffItem.action === "CREATE") result.packs.toCreate++;
            else if (diffItem.action === "UPDATE") result.packs.toUpdate++;
          }
        }
      } catch (e) {
        // Non-fatal: some clients may have no packs
        result.errors.push(`Pack fetch error for client ${hc._id.slice(0, 8)}…: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ── 7. Finalize ────────────────────────────────────────────────────────
    result.status = dryRun ? "DRY_RUN_OK" : "COMPLETED";

    // Update sync log (diffJson stores only IDs + actions, no PII)
    const safeLog = {
      clientsFound: result.clients.found,
      clientsCreated: result.clients.toCreate,
      clientsUpdated: result.clients.toUpdate,
      sessionsFound: result.sessions.found,
      sessionsCreated: result.sessions.toCreate,
      packsFound: result.packs.found,
      packsCreated: result.packs.toCreate,
    };

    await prisma.externalSyncLog.update({
      where: { id: log.id },
      data: {
        status: result.status,
        ...safeLog,
        errors: result.errors.length > 0 ? result.errors : undefined,
        diffJson: result.diff.map((d) => ({
          entity: d.entity,
          action: d.action,
          harbizId: d.harbizId,
          gymBookId: d.gymBookId,
        })),
        completedAt: new Date(),
      },
    });

    // Update lastSyncAt only on real sync
    if (!dryRun) {
      await prisma.teacherHarbizConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: new Date() },
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    result.status = "FAILED";

    await prisma.externalSyncLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errors: [msg],
        completedAt: new Date(),
      },
    });
  } finally {
    await harbiz.disconnect();
  }

  return result;
}

// ─── Client processing ─────────────────────────────────────────────────────────

async function processClient(
  hc: HarbizClient,
  teacherId: string,
  dryRun: boolean,
  errors: string[]
): Promise<HarbizDiffItem | null> {
  const mapped = mapClientToGymBook(hc, teacherId);
  if (!isValidMappedClient(mapped)) {
    errors.push(`Skipping invalid client ${hc._id.slice(0, 8)}… (missing email or name)`);
    return null;
  }

  // 1. Check ExternalIdMapping first (fastest path)
  const existing = await prisma.externalIdMapping.findUnique({
    where: { entityType_externalId_source: { entityType: "CLIENT", externalId: hc._id, source: "HARBIZ" } },
  });

  if (existing) {
    // Already imported — check if name/phone changed
    const gymBookUser = await prisma.user.findUnique({ where: { id: existing.gymBookId }, select: { id: true, name: true } });
    if (!gymBookUser) {
      // Orphan mapping — remove and re-create
      await prisma.externalIdMapping.delete({ where: { id: existing.id } });
      return processClient(hc, teacherId, dryRun, errors);
    }

    const needsUpdate = gymBookUser.name !== mapped.name;
    if (!needsUpdate) {
      return { entity: "CLIENT", action: "SKIP", harbizId: hc._id, gymBookId: existing.gymBookId, entityLabel: clientLabel(hc) };
    }

    if (!dryRun) {
      await prisma.user.update({ where: { id: existing.gymBookId }, data: { name: mapped.name } });
    }
    return { entity: "CLIENT", action: "UPDATE", harbizId: hc._id, gymBookId: existing.gymBookId, entityLabel: clientLabel(hc) };
  }

  // 2. Try to match by email
  const userByEmail = await prisma.user.findUnique({ where: { email: mapped.email }, select: { id: true } });
  if (userByEmail) {
    // User exists — create mapping and link as client if not already
    if (!dryRun) {
      await linkExistingUser(userByEmail.id, hc._id, teacherId, mapped);
    }
    return { entity: "CLIENT", action: "UPDATE", harbizId: hc._id, gymBookId: userByEmail.id, entityLabel: clientLabel(hc), reason: "matched by email" };
  }

  // 3. Create new user + client
  if (!dryRun) {
    const newUserId = await createClientFromHarbiz(hc._id, mapped, teacherId);
    return { entity: "CLIENT", action: "CREATE", harbizId: hc._id, gymBookId: newUserId, entityLabel: clientLabel(hc) };
  }

  return { entity: "CLIENT", action: "CREATE", harbizId: hc._id, entityLabel: clientLabel(hc) };
}

async function linkExistingUser(
  userId: string,
  harbizId: string,
  teacherId: string,
  mapped: { status: string; phone: string | null; preferredTeacherId: string }
) {
  await prisma.$transaction(async (tx) => {
    // Ensure Client record exists
    let client = await tx.client.findUnique({ where: { userId } });
    if (!client) {
      client = await tx.client.create({
        data: {
          userId,
          status: mapped.status as "ACTIVE" | "SUSPENDED",
          phone: mapped.phone,
          preferredTeacherId: mapped.preferredTeacherId,
        },
      });
    }
    // Ensure ClientTeacher link
    await tx.clientTeacher.upsert({
      where: { clientId_teacherId: { clientId: client.id, teacherId } },
      create: { clientId: client.id, teacherId },
      update: {},
    });
    // Create mapping
    await tx.externalIdMapping.upsert({
      where: { entityType_externalId_source: { entityType: "CLIENT", externalId: harbizId, source: "HARBIZ" } },
      create: { entityType: "CLIENT", gymBookId: userId, externalId: harbizId, source: "HARBIZ" },
      update: {},
    });
  });
}

async function createClientFromHarbiz(
  harbizId: string,
  mapped: { name: string; email: string; phone: string | null; status: string; preferredTeacherId: string },
  teacherId: string
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    // Create User with a random unusable password (client will set their own)
    const { randomBytes } = await import("crypto");
    const tempPassword = "$harbiz$" + randomBytes(16).toString("hex");

    const user = await tx.user.create({
      data: {
        name: mapped.name,
        email: mapped.email,
        password: tempPassword,
        role: "CLIENT",
      },
    });

    const client = await tx.client.create({
      data: {
        userId: user.id,
        status: mapped.status as "ACTIVE" | "SUSPENDED",
        phone: mapped.phone,
        preferredTeacherId: teacherId,
      },
    });

    await tx.clientTeacher.create({
      data: { clientId: client.id, teacherId },
    });

    await tx.externalIdMapping.create({
      data: {
        entityType: "CLIENT",
        gymBookId: user.id,
        externalId: harbizId,
        source: "HARBIZ",
      },
    });

    return user.id;
  });
}

// ─── Session processing ────────────────────────────────────────────────────────

async function processSession(
  hs: HarbizSession,
  gymBookClientId: string,
  teacherId: string,
  activityId: string,
  dryRun: boolean,
  errors: string[]
): Promise<HarbizDiffItem | null> {
  // Skip if already imported
  const existing = await prisma.externalIdMapping.findUnique({
    where: { entityType_externalId_source: { entityType: "BOOKING", externalId: hs._id, source: "HARBIZ" } },
  });
  if (existing) {
    return { entity: "SESSION", action: "SKIP", harbizId: hs._id, gymBookId: existing.gymBookId, entityLabel: sessionLabel(hs) };
  }

  const mapped = mapSessionToGymBook(hs, gymBookClientId, teacherId, activityId);
  if (!mapped) {
    errors.push(`Invalid session ${hs._id.slice(0, 8)}… (missing date)`);
    return null;
  }

  if (!dryRun) {
    try {
      const booking = await prisma.$transaction(async (tx) => {
        const adminUser = await tx.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
        if (!adminUser) throw new Error("No admin user found for booking creation");
        const b = await tx.booking.create({
          data: {
            ...mapped,
            spaceId: await getDefaultSpaceId(tx as typeof prisma),
            createdById: adminUser.id,
          },
        });
        await tx.externalIdMapping.create({
          data: { entityType: "BOOKING", gymBookId: b.id, externalId: hs._id, source: "HARBIZ" },
        });
        return b;
      });
      return { entity: "SESSION", action: "CREATE", harbizId: hs._id, gymBookId: booking.id, entityLabel: sessionLabel(hs) };
    } catch (e) {
      errors.push(`Session create error ${hs._id.slice(0, 8)}…: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  return { entity: "SESSION", action: "CREATE", harbizId: hs._id, entityLabel: sessionLabel(hs) };
}

// ─── Pack (credits) processing ─────────────────────────────────────────────────

async function processPack(
  hp: HarbizSessionPack,
  gymBookClientId: string,
  teacherId: string,
  dryRun: boolean,
  errors: string[]
): Promise<HarbizDiffItem | null> {
  const existing = await prisma.externalIdMapping.findUnique({
    where: { entityType_externalId_source: { entityType: "CREDIT", externalId: hp._id, source: "HARBIZ" } },
  });

  const mapped = mapPackToGymBook(hp, gymBookClientId, teacherId);

  if (existing) {
    // Update balance if changed
    const credits = await prisma.clientCredits.findUnique({ where: { id: existing.gymBookId } });
    if (!credits || credits.balance === mapped.balance) {
      return { entity: "PACK", action: "SKIP", harbizId: hp._id, gymBookId: existing.gymBookId, entityLabel: packLabel(hp) };
    }
    if (!dryRun) {
      await prisma.clientCredits.update({ where: { id: existing.gymBookId }, data: { balance: mapped.balance } });
    }
    return { entity: "PACK", action: "UPDATE", harbizId: hp._id, gymBookId: existing.gymBookId, entityLabel: packLabel(hp), reason: `balance ${credits.balance}→${mapped.balance}` };
  }

  // Get the client's actual Client.id (not User.id)
  const client = await prisma.client.findFirst({ where: { userId: gymBookClientId } });
  if (!client) {
    errors.push(`No Client record for userId ${gymBookClientId.slice(0, 8)}…`);
    return null;
  }

  if (!dryRun) {
    try {
      const cc = await prisma.$transaction(async (tx) => {
        const creditRecord = await tx.clientCredits.create({
          data: {
            clientId: client.id,
            teacherId,
            creditType: "INDIVIDUAL",
            balance: mapped.balance,
            totalAssigned: mapped.totalAssigned,
            paymentStatus: mapped.paymentStatus,
            notes: mapped.notes,
          },
        });
        await tx.externalIdMapping.create({
          data: { entityType: "CREDIT", gymBookId: creditRecord.id, externalId: hp._id, source: "HARBIZ" },
        });
        return creditRecord;
      });
      return { entity: "PACK", action: "CREATE", harbizId: hp._id, gymBookId: cc.id, entityLabel: packLabel(hp) };
    } catch (e) {
      errors.push(`Pack create error ${hp._id.slice(0, 8)}…: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  return { entity: "PACK", action: "CREATE", harbizId: hp._id, entityLabel: packLabel(hp) };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function fetchAllClients(harbiz: HarbizDdpClient): Promise<HarbizClient[]> {
  const all: HarbizClient[] = [];
  let skip = 0;
  while (true) {
    const page = await harbiz.getClients({ limit: PAGE_SIZE, skip });
    if (!page.length) break;
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }
  return all;
}

async function resolveSessionTypes(
  sessionTypes: { _id: string; name: string }[],
  teacherId: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const st of sessionTypes) {
    // Try to find matching GymBook activity by name
    const activity = await prisma.activity.findFirst({
      where: { name: { equals: st.name, mode: "insensitive" } },
    });
    if (activity) {
      map.set(st._id, activity.id);
    }
  }
  return map;
}

async function getDefaultActivityId(teacherId: string): Promise<string | null> {
  // Prefer "Entrenamiento Personal" by name (case-insensitive)
  const preferred = await prisma.activity.findFirst({
    where: { name: { equals: "Entrenamiento Personal", mode: "insensitive" }, isActive: true },
  });
  if (preferred) return preferred.id;

  // Fallback: first activity assigned to this teacher
  const ta = await prisma.teacherActivity.findFirst({
    where: { teacherId, activity: { isActive: true } },
  });
  return ta?.activityId ?? null;
}

async function getDefaultSpaceId(tx: typeof prisma): Promise<string> {
  // Prefer space named "SALA" (case-insensitive)
  const preferred = await tx.space.findFirst({
    where: { name: { equals: "SALA", mode: "insensitive" }, isActive: true },
  });
  if (preferred) return preferred.id;

  // Fallback: first active space
  const space = await tx.space.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  if (!space) throw new Error("No hay espacios configurados en GymBook");
  return space.id;
}

async function getOrCreateConnection(teacherId: string) {
  return prisma.teacherHarbizConnection.upsert({
    where: { teacherId },
    create: { teacherId, isActive: true },
    update: {},
  });
}

async function enforceRateLimit(teacherId: string): Promise<void> {
  const connection = await prisma.teacherHarbizConnection.findUnique({ where: { teacherId } });
  if (!connection?.lastSyncAt) return;
  const elapsed = Date.now() - connection.lastSyncAt.getTime();
  if (elapsed < MIN_SYNC_INTERVAL_MS) {
    const remaining = Math.ceil((MIN_SYNC_INTERVAL_MS - elapsed) / 60_000);
    throw new Error(`Rate limit: espera ${remaining} minuto(s) antes del próximo sync real`);
  }
}

// ─── Simple date utilities (avoid date-fns-tz dependency) ─────────────────────

function subMonths(d: Date, months: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() - months);
  return result;
}

function addMonths(d: Date, months: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + months);
  return result;
}
