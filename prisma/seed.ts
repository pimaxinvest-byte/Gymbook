/**
 * GymBook Production Seed — idempotent, safe for re-runs
 * Uses upsert everywhere. Never deletes real data.
 * Test/demo data is created only if env SEED_DEMO=true
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 GymBook seed iniciando...\n");

  // ─── 1. ADMIN ────────────────────────────────────────────────
  const adminPass = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@gymbook.com" },
    update: {},
    create: {
      name: "Admin Principal",
      email: "admin@gymbook.com",
      password: adminPass,
      role: "ADMIN",
    },
  });
  console.log("✓ Admin:", admin.email);

  // ─── 2. ESPACIOS REALES ──────────────────────────────────────
  // Only SALA and EXTERIOR — no test spaces
  const spacesData = [
    { name: "SALA",     description: "Sala interior con equipamiento completo", capacity: 10 },
    { name: "EXTERIOR", description: "Zona exterior polivalente",               capacity: 20 },
  ];

  const spaces: Record<string, { id: string; name: string }> = {};
  for (const s of spacesData) {
    const space = await prisma.space.upsert({
      where:  { name: s.name },
      update: { description: s.description, capacity: s.capacity, isActive: true },
      create: { name: s.name, description: s.description, capacity: s.capacity },
    });
    spaces[s.name] = space;
    console.log("✓ Espacio:", space.name);
  }

  // ─── 3. ACTIVIDADES REALES ───────────────────────────────────
  const activitiesData = [
    {
      name: "Entrenamiento Personal",
      description: "Sesión individual con tu entrenador personal",
      defaultDuration: 60,
      maxCapacity: 1,
      color: "#f97316",  // orange
    },
    {
      name: "Yoga",
      description: "Yoga para todos los niveles. Máximo 5 personas.",
      defaultDuration: 60,
      maxCapacity: 5,
      color: "#8b5cf6",  // purple
    },
  ];

  const activities: Record<string, { id: string; name: string }> = {};
  for (const a of activitiesData) {
    const activity = await prisma.activity.upsert({
      where:  { name: a.name },
      update: { description: a.description, defaultDuration: a.defaultDuration, maxCapacity: a.maxCapacity, color: a.color, isActive: true },
      create: a,
    });
    activities[a.name] = activity;
    console.log("✓ Actividad:", activity.name);
  }

  // ─── 4. PROFESORES REALES ────────────────────────────────────
  // Lola's temp password (shown only in log, never in frontend)
  const lolaTempPassword = "Lola" + crypto.randomBytes(4).toString("hex") + "!";

  const teachersData = [
    {
      name:            "Max Romeo",
      email:           "max.romeo@me.com",
      password:        "Max123",
      color:           "#2563eb",  // blue
      bio:             "Entrenador personal y fisicoculturista",
      telegramUsername: "@maxesi987",
      telegramPhone:   "+34615110445",
      activities:      ["Entrenamiento Personal"],
    },
    {
      name:            "Pietro Anoe",
      email:           "rohypus@gmail.com",
      password:        "Pietro123",
      color:           "#f97316",  // orange
      bio:             "Entrenador y preparador",
      telegramUsername: "@rohypus",
      activities:      ["Entrenamiento Personal"],
    },
    {
      name:            "Lola Martin Carmona",
      email:           "lolamarca@hotmail.es",
      password:        lolaTempPassword,
      color:           "#8b5cf6",  // purple
      bio:             "Profesora de yoga",
      telegramPhone:   "+34686367127",
      activities:      ["Yoga"],
    },
  ];

  console.log("\n⚠️  Contraseña temporal de Lola Martin Carmona:", lolaTempPassword);
  console.log("    (Cámbiala desde el panel admin o perfil de profesor)\n");

  const createdTeachers: { id: string; userId: string }[] = [];

  for (const t of teachersData) {
    const hashed = await bcrypt.hash(t.password, 12);

    // User (upsert by email — never overwrite password if already set)
    const existingUser = await prisma.user.findUnique({ where: { email: t.email } });
    const user = await prisma.user.upsert({
      where:  { email: t.email },
      update: {
        name:            t.name,
        telegramUsername: t.telegramUsername ?? undefined,
        telegramPhone:   t.telegramPhone ?? undefined,
      },
      create: {
        name:            t.name,
        email:           t.email,
        password:        hashed,
        role:            "TEACHER",
        telegramUsername: t.telegramUsername ?? undefined,
        telegramPhone:   t.telegramPhone ?? undefined,
      },
    });

    if (existingUser) {
      console.log("↺ Profesor existente (password no cambiado):", user.email);
    } else {
      console.log("✓ Profesor creado:", user.email);
    }

    // Teacher profile
    const teacher = await prisma.teacher.upsert({
      where:  { userId: user.id },
      update: { color: t.color, bio: t.bio },
      create: { userId: user.id, color: t.color, bio: t.bio },
    });
    createdTeachers.push(teacher);

    // Assign activities (idempotent)
    for (const actName of t.activities) {
      const act = activities[actName];
      if (!act) continue;
      await prisma.teacherActivity.upsert({
        where:  { teacherId_activityId: { teacherId: teacher.id, activityId: act.id } },
        update: {},
        create: { teacherId: teacher.id, activityId: act.id },
      });
    }
  }

  // ─── 5. APP SETTINGS ─────────────────────────────────────────
  await prisma.appSettings.upsert({
    where:  { id: "default" },
    update: {},
    create: {
      id:                     "default",
      gymName:                "GymBook",
      primaryColor:           "#f97316",
      secondaryColor:         "#ea580c",
      accentColor:            "#fb923c",
      defaultSessionDuration: 60,
      openingTime:            "07:00",
      closingTime:            "22:00",
      bookingConfirmationText: "¡Tu sesión ha sido confirmada! Nos vemos pronto.",
      cancellationHoursLimit:  24,
      cancellationRefundCredits: true,
      creditExpiryMonths:     6,
      sgtMaxClients:          5,
      requireAdminApproval:   true,
    },
  });
  console.log("✓ AppSettings configuradas");

  // Telegram settings — real bot config
  await prisma.telegramSettings.upsert({
    where:  { id: "default" },
    update: {
      botToken:  "8720707969:AAF6O657jjMlU27UL34fXRPb_rgWn2NCyV8",
      botName:   "Daddysgymbook_bot",
    },
    create: {
      id:            "default",
      botToken:      "8720707969:AAF6O657jjMlU27UL34fXRPb_rgWn2NCyV8",
      botName:       "Daddysgymbook_bot",
      notifyAdmin:   true,
      notifyTeacher: true,
      notifyClient:  true,
    },
  });
  console.log("✓ TelegramSettings (Daddysgymbook_bot)");

  // ─── 6. DEMO DATA (only if SEED_DEMO=true) ───────────────────
  if (process.env.SEED_DEMO === "true") {
    console.log("\n📦 SEED_DEMO activado — creando clientes de ejemplo...");
    const clientPass = await bcrypt.hash("client123", 12);

    const demoClients = [
      { name: "Ana López",    email: "ana@example.com",   status: "ACTIVE"   as const },
      { name: "Pedro Ruiz",   email: "pedro@example.com", status: "ACTIVE"   as const },
      { name: "María García", email: "maria@example.com", status: "PENDING"  as const },
    ];

    for (const c of demoClients) {
      const user = await prisma.user.upsert({
        where:  { email: c.email },
        update: {},
        create: { name: c.name, email: c.email, password: clientPass, role: "CLIENT" },
      });
      await prisma.client.upsert({
        where:  { userId: user.id },
        update: {},
        create: { userId: user.id, status: c.status, acceptedTerms: true },
      });
      console.log("  ✓ Cliente demo:", user.email);
    }
  }

  // ─── SUMMARY ─────────────────────────────────────────────────
  console.log("\n✅ Seed completado!\n");
  console.log("Cuentas de acceso:");
  console.log("  Admin:    admin@gymbook.com / admin123");
  console.log("  Profesor: max.romeo@me.com / Max123");
  console.log("  Profesor: rohypus@gmail.com / Pietro123");
  console.log("  Profesor: lolamarca@hotmail.es /", lolaTempPassword, "(temporal)");
  if (process.env.SEED_DEMO === "true") {
    console.log("  Cliente:  ana@example.com / client123");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
