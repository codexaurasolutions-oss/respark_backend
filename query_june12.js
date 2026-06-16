import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const from = new Date("2026-06-12T00:00:00.000Z");
const to = new Date("2026-06-13T00:00:00.000Z");
prisma.appointment.findMany({
  where: {
    AND: [
      { startAt: { lte: to } },
      { endAt: { gte: from } }
    ]
  },
  include: { items: { include: { assignedStaff: true } } }
}).then((data) => {
  console.log("Count:", data.length);
  data.forEach(d => console.log(d.id, d.startAt, d.endAt, d.primaryStaffUserId));
  prisma.$disconnect();
}).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
