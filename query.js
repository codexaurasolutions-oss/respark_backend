import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.appointment.findMany({
  orderBy: { createdAt: "desc" },
  take: 4,
  include: { items: { include: { assignedStaff: true } } }
}).then((data) => {
  console.log(JSON.stringify(data, null, 2));
  prisma.$disconnect();
}).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
