import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { defaultOwnerPermissions } from "../../src/lib/permissions.js";

const prisma = new PrismaClient();

async function main() {
  const superAdminEmail = "superadmin@respark.local";
  const ownerEmail = "owner@respark.local";

  const starterPlan = await prisma.plan.upsert({
    where: { name: "Starter" },
    update: {
      monthlyPrice: 4999,
      yearlyPrice: 49990,
      trialDays: 7,
      branchLimit: 1,
      userLimit: 5,
      customerLimit: 500,
      invoiceLimit: 1000,
      storageLimit: 5,
      featureFlags: { pos: true, crm: true, reports: true, publicCatalog: true, digitalCatalog: true, customerPortal: true, ecommerce: true, onlineOrders: true, campaigns: true, messageTemplates: true, catalogAnalytics: true }
    },
    create: {
      name: "Starter",
      monthlyPrice: 4999,
      yearlyPrice: 49990,
      trialDays: 7,
      branchLimit: 1,
      userLimit: 5,
      customerLimit: 500,
      invoiceLimit: 1000,
      storageLimit: 5,
      featureFlags: { pos: true, crm: true, reports: true, publicCatalog: true, digitalCatalog: true, customerPortal: true, ecommerce: true, onlineOrders: true, campaigns: true, messageTemplates: true, catalogAnalytics: true }
    }
  });

  const growthPlan = await prisma.plan.upsert({
    where: { name: "Growth" },
    update: {
      monthlyPrice: 9999,
      yearlyPrice: 99990,
      trialDays: 7,
      branchLimit: 3,
      userLimit: 20,
      customerLimit: 3000,
      invoiceLimit: 10000,
      storageLimit: 20,
      featureFlags: { pos: true, crm: true, reports: true, publicCatalog: true, whatsapp: true, digitalCatalog: true, customerPortal: true, ecommerce: true, onlineOrders: true, campaigns: true, messageTemplates: true, catalogAnalytics: true }
    },
    create: {
      name: "Growth",
      monthlyPrice: 9999,
      yearlyPrice: 99990,
      trialDays: 7,
      branchLimit: 3,
      userLimit: 20,
      customerLimit: 3000,
      invoiceLimit: 10000,
      storageLimit: 20,
      featureFlags: { pos: true, crm: true, reports: true, publicCatalog: true, whatsapp: true, digitalCatalog: true, customerPortal: true, ecommerce: true, onlineOrders: true, campaigns: true, messageTemplates: true, catalogAnalytics: true }
    }
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      name: "Super Admin",
      systemRole: "SUPER_ADMIN",
      passwordHash: await bcrypt.hash("Admin@123", 10)
    }
  });

  const salon = await prisma.salon.upsert({
    where: { slug: "demo-salon" },
    update: {
      businessType: "Salon",
      email: "demo@salon.local",
      phone: "+923001112233",
      city: "Lahore",
      country: "Pakistan",
      currency: "PKR",
      taxRate: 5,
      status: "ACTIVE",
      featureFlags: { pos: true, appointments: true, inventory: true, reports: true, publicCatalog: true, digitalCatalog: true, customerPortal: true, ecommerce: true, onlineOrders: true, campaigns: true, messageTemplates: true, catalogAnalytics: true }
    },
    create: {
      name: "Demo Salon",
      slug: "demo-salon",
      businessType: "Salon",
      email: "demo@salon.local",
      phone: "+923001112233",
      city: "Lahore",
      country: "Pakistan",
      currency: "PKR",
      taxRate: 5,
      trialStartsAt: new Date(),
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
      featureFlags: { pos: true, appointments: true, inventory: true, reports: true, publicCatalog: true, digitalCatalog: true, customerPortal: true, ecommerce: true, onlineOrders: true, campaigns: true, messageTemplates: true, catalogAnalytics: true }
    }
  });

  const branch = await prisma.branch.upsert({
    where: { id: "seed-main-branch" },
    update: {
      salonId: salon.id,
      name: "Main Branch",
      address: "Mall Road",
      phone: "+923001112233",
      isActive: true
    },
    create: {
      id: "seed-main-branch",
      salonId: salon.id,
      name: "Main Branch",
      address: "Mall Road",
      phone: "+923001112233",
      isActive: true
    }
  });

  const category = await prisma.productCategory.upsert({
    where: { id: "seed-retail-category" },
    update: { salonId: salon.id, name: "Retail" },
    create: { id: "seed-retail-category", salonId: salon.id, name: "Retail" }
  });

  await prisma.product.upsert({
    where: { salonId_sku: { salonId: salon.id, sku: "SERUM-001" } },
    update: {
      branchId: branch.id,
      categoryId: category.id,
      name: "Repair Serum",
      productType: "RETAIL",
      costPrice: 1200,
      sellingPrice: 1800,
      currentStock: 20,
      minStock: 3,
      isOnlineVisible: true,
      isActive: true
    },
    create: {
      salonId: salon.id,
      branchId: branch.id,
      categoryId: category.id,
      name: "Repair Serum",
      sku: "SERUM-001",
      productType: "RETAIL",
      costPrice: 1200,
      sellingPrice: 1800,
      currentStock: 20,
      minStock: 3,
      isOnlineVisible: true,
      isActive: true
    }
  });

  const existingCatalogSetting = await prisma.catalogSetting.findFirst({
    where: { salonId: salon.id, branchId: null }
  });
  const catalogSettingPayload = {
    catalogEnabled: true,
    customSlug: "demo-salon",
    showServices: true,
    showPackages: true,
    showMemberships: true,
    showProducts: true,
    showStaffPortfolio: true,
    whatsappNumber: "+923001112233",
    themeColor: "#0f766e"
  };
  if (existingCatalogSetting) {
    await prisma.catalogSetting.update({
      where: { id: existingCatalogSetting.id },
      data: catalogSettingPayload
    });
  } else {
    await prisma.catalogSetting.create({
      data: {
        salonId: salon.id,
        branchId: null,
        ...catalogSettingPayload
      }
    });
  }

  await prisma.ecommerceSetting.upsert({
    where: { salonId: salon.id },
    update: {
      storeEnabled: true,
      allowCod: true,
      allowPayAtSalon: true,
      pickupEnabled: true
    },
    create: {
      salonId: salon.id,
      storeEnabled: true,
      allowCod: true,
      allowPayAtSalon: true,
      pickupEnabled: true
    }
  });

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      email: ownerEmail,
      name: "Salon Owner",
      systemRole: "SALON_USER",
      passwordHash: await bcrypt.hash("Owner@123", 10)
    }
  });

  await prisma.userSalon.upsert({
    where: { userId_salonId: { userId: owner.id, salonId: salon.id } },
    update: {
      salonRole: "SALON_OWNER",
      permissions: defaultOwnerPermissions
    },
    create: {
      userId: owner.id,
      salonId: salon.id,
      salonRole: "SALON_OWNER",
      permissions: defaultOwnerPermissions
    }
  });

  await prisma.subscription.upsert({
    where: { id: "seed-demo-subscription" },
    update: {
      planId: growthPlan.id,
      status: "ACTIVE",
      paymentStatus: "PAID",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: "Seeded active subscription"
    },
    create: {
      id: "seed-demo-subscription",
      salonId: salon.id,
      planId: growthPlan.id,
      status: "ACTIVE",
      paymentStatus: "PAID",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: "Seeded active subscription"
    }
  });

  console.log({ superAdmin: superAdmin.email, owner: owner.email, salonId: salon.id });
}

main().finally(() => prisma.$disconnect());
