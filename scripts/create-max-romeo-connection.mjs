import { PrismaClient } from '@prisma/client';

const MAX_ROMEO_TEACHER_ID = "cmptnd84i0007bj0pnej7tvwk";
const MAX_ROMEO_HARBIZ_EMAIL = "max.ro87@gmail.com";

const p = new PrismaClient();

try {
  const conn = await p.teacherHarbizConnection.upsert({
    where: { teacherId: MAX_ROMEO_TEACHER_ID },
    create: {
      teacherId: MAX_ROMEO_TEACHER_ID,
      harbizEmail: MAX_ROMEO_HARBIZ_EMAIL,
      // No harbizPasswordEncrypted — credentials come from env vars (HARBIZ_EMAIL / HARBIZ_PASSWORD)
      isActive: true,
    },
    update: {
      harbizEmail: MAX_ROMEO_HARBIZ_EMAIL,
      isActive: true,
    },
    select: { id: true, teacherId: true, harbizEmail: true, isActive: true, createdAt: true },
  });

  console.log("✓ TeacherHarbizConnection created/updated for Max Romeo:");
  console.log(JSON.stringify(conn, null, 2));
} finally {
  await p.$disconnect();
}
