import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Updating database to change +92 to +91 and set country/currency to India/INR...");

  // Helper to replace +92 with +91
  const fixPhone = (phone) => {
    if (!phone) return phone;
    if (phone.startsWith("+92")) {
      return "+91" + phone.slice(3);
    }
    if (phone.startsWith("92") && phone.length > 10) {
      return "+91" + phone.slice(2);
    }
    return phone;
  };

  // 1. Salons
  const salons = await prisma.salon.findMany();
  for (const s of salons) {
    const updatedPhone = fixPhone(s.phone);
    await prisma.salon.update({
      where: { id: s.id },
      data: {
        phone: updatedPhone,
        country: "India",
        currency: "INR"
      }
    });
    console.log(`Updated Salon ${s.name}: phone=${updatedPhone}, country=India, currency=INR`);
  }

  // 2. Branches
  const branches = await prisma.branch.findMany();
  for (const b of branches) {
    const updatedPhone = fixPhone(b.phone);
    await prisma.branch.update({
      where: { id: b.id },
      data: { phone: updatedPhone }
    });
    console.log(`Updated Branch ${b.name}: phone=${updatedPhone}`);
  }

  // 3. Customers
  const customers = await prisma.customer.findMany();
  let customerCount = 0;
  for (const c of customers) {
    const updatedPhone = fixPhone(c.phone);
    if (updatedPhone !== c.phone) {
      await prisma.customer.update({
        where: { id: c.id },
        data: { phone: updatedPhone }
      });
      customerCount++;
    }
  }
  console.log(`Updated ${customerCount} customers from +92 to +91`);

  // 4. UserSalon (Staff/Users)
  const userSalons = await prisma.userSalon.findMany();
  let userSalonCount = 0;
  for (const us of userSalons) {
    const updatedPhone = fixPhone(us.phone);
    if (updatedPhone !== us.phone) {
      await prisma.userSalon.update({
        where: { id: us.id },
        data: { phone: updatedPhone }
      });
      userSalonCount++;
    }
  }
  console.log(`Updated ${userSalonCount} user salon members from +92 to +91`);

  // 5. Vendors
  const vendors = await prisma.vendor.findMany();
  let vendorCount = 0;
  for (const v of vendors) {
    const updatedPhone = fixPhone(v.phone);
    if (updatedPhone !== v.phone) {
      await prisma.vendor.update({
        where: { id: v.id },
        data: { phone: updatedPhone }
      });
      vendorCount++;
    }
  }
  console.log(`Updated ${vendorCount} vendors from +92 to +91`);

  console.log("Database update completed successfully.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
