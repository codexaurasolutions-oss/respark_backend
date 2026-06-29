import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const email = process.env.ATTENDANCE_USER_EMAIL || "owner@respark.local";

try {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: true }
  });

  if (!user?.memberships?.length) {
    throw new Error(`No salon membership found for ${email}.`);
  }

  const membershipId = user.memberships[0].id;
  const record = await prisma.attendanceRecord.findFirst({
    where: { userSalonId: membershipId },
    orderBy: { createdAt: "desc" }
  });

  console.log(JSON.stringify({
    userEmail: email,
    membershipId,
    attendance: record
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
