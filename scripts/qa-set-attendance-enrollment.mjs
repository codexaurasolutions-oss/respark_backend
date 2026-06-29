import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const email = process.env.ATTENDANCE_USER_EMAIL || "owner@respark.local";
const photoUrl = process.env.ATTENDANCE_PHOTO_URL;

if (!photoUrl) {
  console.error("ATTENDANCE_PHOTO_URL is required.");
  process.exit(1);
}

try {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: true }
  });

  if (!user?.memberships?.length) {
    throw new Error(`No salon membership found for ${email}.`);
  }

  const membership = user.memberships[0];

  const updatedMembership = await prisma.userSalon.update({
    where: { id: membership.id },
    data: {
      attendanceEnabled: true,
      attendanceEnrollmentPhotoUrl: photoUrl,
      attendanceEnrollmentCapturedAt: new Date()
    }
  });

  console.log(JSON.stringify({
    userEmail: email,
    membershipId: updatedMembership.id,
    branchId: updatedMembership.branchId,
    attendanceEnabled: updatedMembership.attendanceEnabled,
    attendanceEnrollmentPhotoUrl: updatedMembership.attendanceEnrollmentPhotoUrl
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
