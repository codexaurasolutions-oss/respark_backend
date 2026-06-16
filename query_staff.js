import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.userSalon.findMany({
  include: { user: true }
}).then((data) => {
  data.forEach(d => console.log(d.id, d.user.name, d.salonRole));
  prisma.$disconnect();
}).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
