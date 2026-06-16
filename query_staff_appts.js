import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.appointmentServiceStaff.findMany({
  where: { userSalonId: "cmqbjy6zt000epddc186rxy66" }
}).then((data) => {
  console.log(data);
  prisma.$disconnect();
}).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
