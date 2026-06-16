import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.user.findUnique({
  where: { id: "cmqbjy6zt000epddc186rxy66" }
}).then((u) => {
  console.log(u);
  prisma.$disconnect();
}).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
