import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Admin
  const adminPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@gymbook.com" },
    update: {},
    create: {
      name: "Admin Principal",
      email: "admin@gymbook.com",
      password: adminPassword,
      role: "ADMIN",
    },
  });
  console.log("✓ Admin:", admin.email);

  // Teachers
  const teacherData = [
    { name: "Carlos Martínez", email: "carlos@gymbook.com", color: "#6366f1", bio: "Especialista en CrossFit y funcional" },
    { name: "Laura García", email: "laura@gymbook.com", color: "#ec4899", bio: "Instructora de yoga y pilates" },
    { name: "Miguel Torres", email: "miguel@gymbook.com", color: "#f59e0b", bio: "Entrenador personal certificado" },
  ];

  const teacherPass = await bcrypt.hash("teacher123", 12);
  const teachers = [];

  for (const t of teacherData) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: { name: t.name, email: t.email, password: teacherPass, role: "TEACHER" },
    });
    const teacher = await prisma.teacher.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, color: t.color, bio: t.bio },
    });
    teachers.push({ ...teacher, user });
    console.log("✓ Profesor:", user.email);
  }

  // Clients
  const clientData = [
    { name: "Ana López", email: "ana@example.com" },
    { name: "Pedro Sánchez", email: "pedro@example.com" },
    { name: "María Ruiz", email: "maria@example.com" },
  ];

  const clientPass = await bcrypt.hash("client123", 12);

  for (const c of clientData) {
    const user = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { name: c.name, email: c.email, password: clientPass, role: "CLIENT" },
    });
    await prisma.client.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
    console.log("✓ Cliente:", user.email);
  }

  // Spaces
  const spacesData = [
    { name: "Sala Principal", description: "Sala grande con equipamiento completo", capacity: 20 },
    { name: "Sala Cardio", description: "Cintas y bicicletas", capacity: 15 },
    { name: "Sala Yoga", description: "Sala tranquila para yoga y pilates", capacity: 12 },
    { name: "Box CrossFit", description: "Zona de entrenamiento funcional", capacity: 10 },
  ];

  const spaces = [];
  for (const s of spacesData) {
    const space = await prisma.space.upsert({
      where: { id: s.name },
      update: {},
      create: s,
    }).catch(async () => {
      return prisma.space.create({ data: s });
    });
    spaces.push(space);
    console.log("✓ Espacio:", space.name);
  }

  // Activities
  const activitiesData = [
    { name: "CrossFit", description: "Entrenamiento funcional de alta intensidad", defaultDuration: 60, maxCapacity: 10, color: "#6366f1" },
    { name: "Yoga", description: "Yoga para todos los niveles", defaultDuration: 60, maxCapacity: 12, color: "#ec4899" },
    { name: "Pilates", description: "Fortalecimiento y flexibilidad", defaultDuration: 60, maxCapacity: 8, color: "#8b5cf6" },
    { name: "Entrenamiento Personal", description: "Sesión 1 a 1 con el entrenador", defaultDuration: 60, maxCapacity: 1, color: "#f59e0b" },
    { name: "HIIT", description: "Alta intensidad, 45 minutos", defaultDuration: 45, maxCapacity: 15, color: "#ef4444" },
    { name: "Spinning", description: "Ciclismo indoor", defaultDuration: 45, maxCapacity: 15, color: "#10b981" },
  ];

  const activities = [];
  for (const a of activitiesData) {
    const activity = await prisma.activity.create({ data: a }).catch(async () => {
      return prisma.activity.findFirst({ where: { name: a.name } });
    });
    if (activity) activities.push(activity);
    console.log("✓ Actividad:", a.name);
  }

  // App settings
  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      gymName: "GymBook Demo",
      primaryColor: "#6366f1",
      secondaryColor: "#8b5cf6",
      defaultSessionDuration: 60,
      openingTime: "07:00",
      closingTime: "22:00",
      bookingConfirmationText: "¡Tu sesión ha sido reservada con éxito! Nos vemos pronto.",
      cancellationHoursLimit: 24,
    },
  });

  // Telegram settings placeholder
  await prisma.telegramSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      notifyAdmin: true,
      notifyTeacher: true,
      notifyClient: true,
    },
  });

  // Sample bookings for next 7 days
  if (teachers.length > 0 && spaces.length > 0 && activities.length > 0) {
    const today = new Date();
    const bookingData = [];

    for (let day = 0; day < 7; day++) {
      const date = new Date(today);
      date.setDate(today.getDate() + day);

      // Morning slots
      const morning = new Date(date);
      morning.setHours(9, 0, 0, 0);
      const morningEnd = new Date(date);
      morningEnd.setHours(10, 0, 0, 0);

      bookingData.push({
        teacherId: teachers[0].id,
        spaceId: spaces[0].id,
        activityId: activities[0].id,
        startDatetime: morning,
        endDatetime: morningEnd,
        status: "AVAILABLE" as const,
        color: teachers[0].color,
        createdById: admin.id,
      });

      // Afternoon slots
      const afternoon = new Date(date);
      afternoon.setHours(17, 0, 0, 0);
      const afternoonEnd = new Date(date);
      afternoonEnd.setHours(18, 0, 0, 0);

      if (teachers[1]) {
        bookingData.push({
          teacherId: teachers[1].id,
          spaceId: spaces[2].id,
          activityId: activities[1].id,
          startDatetime: afternoon,
          endDatetime: afternoonEnd,
          status: "AVAILABLE" as const,
          color: teachers[1].color,
          createdById: admin.id,
        });
      }
    }

    await prisma.booking.createMany({ data: bookingData });
    console.log(`✓ ${bookingData.length} reservas de ejemplo creadas`);
  }

  console.log("\n✅ Seed completado!");
  console.log("\nCuentas de acceso:");
  console.log("  Admin:    admin@gymbook.com / admin123");
  console.log("  Profesor: carlos@gymbook.com / teacher123");
  console.log("  Cliente:  ana@example.com / client123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
