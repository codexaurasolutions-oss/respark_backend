import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";

async function main() {
  console.log("Seeding Salon Owner Account: ahmedbilalkhangl09@gmail.com ...");

  const email = "ahmedbilalkhangl09@gmail.com";
  const rawPassword = "test1234";
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  // 1. Create or update User
  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    user = await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        isActive: true,
        passwordSetupRequired: false,
        isDemoAccount: false,
        name: "Ahmed Bilal Khan"
      }
    });
    console.log(`Updated existing user: ${user.id} (${user.email})`);
  } else {
    user = await prisma.user.create({
      data: {
        email,
        name: "Ahmed Bilal Khan",
        passwordHash,
        systemRole: "SALON_USER",
        passwordSetupRequired: false,
        isDemoAccount: false,
        isActive: true
      }
    });
    console.log(`Created new user: ${user.id} (${user.email})`);
  }

  // 2. Create or find Salon
  const salonSlug = "ahmed-bilal-luxury-salon";
  let salon = await prisma.salon.findUnique({ where: { slug: salonSlug } });
  if (!salon) {
    salon = await prisma.salon.create({
      data: {
        name: "Ahmed Bilal Luxury Salon",
        slug: salonSlug,
        email,
        phone: "+91 98765 43210",
        address: "742 Executive Avenue, Suite 100",
        city: "Mumbai",
        country: "India",
        currency: "INR",
        status: "ACTIVE"
      }
    });
    console.log(`Created salon: ${salon.id} (${salon.name})`);
  } else {
    console.log(`Found existing salon: ${salon.id} (${salon.name})`);
  }

  // 3. Link User to Salon as SALON_OWNER
  let userSalon = await prisma.userSalon.findUnique({
    where: {
      userId_salonId: {
        userId: user.id,
        salonId: salon.id
      }
    }
  });

  if (!userSalon) {
    userSalon = await prisma.userSalon.create({
      data: {
        userId: user.id,
        salonId: salon.id,
        salonRole: "SALON_OWNER"
      }
    });
    console.log(`Linked user ${user.id} to salon ${salon.id} as SALON_OWNER`);
  } else {
    console.log(`UserSalon membership already exists for user ${user.id} & salon ${salon.id}`);
  }

  // 4. Seed sample branch
  let branch = await prisma.branch.findFirst({ where: { salonId: salon.id } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        salonId: salon.id,
        name: "Main Flagship Branch",
        address: "742 Executive Avenue"
      }
    });
  }

  // 5. Seed sample customers
  const customer1 = await prisma.customer.upsert({
    where: { id: "c-test-01" },
    update: {},
    create: {
      id: "c-test-01",
      salonId: salon.id,
      name: "Priya Sharma",
      email: "priya.sharma@example.com",
      phone: "+91 98111 22334"
    }
  });

  const customer2 = await prisma.customer.upsert({
    where: { id: "c-test-02" },
    update: {},
    create: {
      id: "c-test-02",
      salonId: salon.id,
      name: "Rohan Varma",
      email: "rohan.varma@example.com",
      phone: "+91 98222 33445"
    }
  });

  // 6. Seed sample invoices for today & this week
  const today = new Date();

  await prisma.invoice.create({
    data: {
      salonId: salon.id,
      branchId: branch.id,
      customerId: customer1.id,
      invoiceNumber: `INV-AB-${Date.now().toString().slice(-6)}`,
      subtotal: 4500,
      tax: 810,
      discount: 0,
      total: 5310,
      status: "PAID",
      createdAt: today
    }
  });

  await prisma.invoice.create({
    data: {
      salonId: salon.id,
      branchId: branch.id,
      customerId: customer2.id,
      invoiceNumber: `INV-AB-${(Date.now() + 1).toString().slice(-6)}`,
      subtotal: 7200,
      tax: 1296,
      discount: 500,
      total: 7996,
      status: "PAID",
      createdAt: today
    }
  });

  // 7. Seed sample appointments
  await prisma.appointment.create({
    data: {
      salonId: salon.id,
      branchId: branch.id,
      customerId: customer1.id,
      startAt: today,
      endAt: new Date(today.getTime() + 60 * 60 * 1000),
      status: "COMPLETED"
    }
  });

  // 8. Seed sample expense
  await prisma.expense.create({
    data: {
      salonId: salon.id,
      branchId: branch.id,
      title: "Salon Styling Supplies & Organic Shampoos",
      amount: 1450,
      expenseDate: today
    }
  });

  console.log("\n==================================================");
  console.log("SALON OWNER ACCOUNT READY!");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${rawPassword}`);
  console.log(`Salon:    ${salon.name}`);
  console.log("==================================================\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
