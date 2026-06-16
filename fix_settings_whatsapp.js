import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.salonSetting.updateMany({
  data: {
    whatsappNumber: "+919876543210"
  }
}).then((result) => {
  console.log("Updated settings:", result);
  prisma.$disconnect();
}).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
