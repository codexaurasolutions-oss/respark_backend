import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.salonSetting.findFirst().then((s) => {
  console.log(JSON.stringify(s, null, 2));
  prisma.$disconnect();
}).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
