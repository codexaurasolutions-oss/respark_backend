import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";

async function main() {
  const email = "superadmin@salonnest.in";
  const rawPassword = "admin123";
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Super admin already exists.");
  } else {
    await prisma.user.create({
      data: {
        email,
        name: "Super Admin",
        passwordHash,
        systemRole: "SUPER_ADMIN",
        passwordSetupRequired: false,
        isDemoAccount: false,
        isActive: true
      }
    });
    console.log("Super admin created.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
