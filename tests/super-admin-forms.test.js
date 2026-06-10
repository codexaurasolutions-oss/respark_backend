import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  $transaction: vi.fn(),
  globalSetting: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  },
  salon: {
    create: vi.fn(),
    update: vi.fn()
  },
  plan: {
    create: vi.fn()
  },
  subscription: {
    create: vi.fn()
  },
  user: {
    create: vi.fn()
  },
  userSalon: {
    create: vi.fn()
  }
};

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-owner-password") },
  hash: vi.fn().mockResolvedValue("hashed-owner-password")
}));

const { superAdminRouter } = await import("../src/modules/superAdmin/routes.js");
const { errorHandler } = await import("../src/middlewares/error.js");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = {
      userId: "super-1",
      name: "Super Admin",
      systemRole: "SUPER_ADMIN"
    };
    next();
  });
  app.use("/super-admin", superAdminRouter);
  app.use(errorHandler);
  return app;
};

describe("super admin salon and plan forms", () => {
  beforeEach(() => {
    prismaMock.salon.create.mockReset();
    prismaMock.salon.update.mockReset();
    prismaMock.plan.create.mockReset();
    prismaMock.subscription.create.mockReset();
    prismaMock.globalSetting.findFirst.mockReset();
    prismaMock.globalSetting.create.mockReset();
    prismaMock.globalSetting.update.mockReset();
    prismaMock.user.create.mockReset();
    prismaMock.userSalon.create.mockReset();
    prismaMock.$transaction.mockReset();
  });

  it("accepts local testing emails for salon creation", async () => {
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock));
    prismaMock.salon.create.mockResolvedValue({
      id: "salon-1",
      name: "Abcd",
      slug: "test-live",
      email: "abcd@local"
    });
    prismaMock.user.create.mockResolvedValue({ id: "user-1" });
    prismaMock.userSalon.create.mockResolvedValue({ id: "user-salon-1" });

    const response = await request(buildApp()).post("/super-admin/salons").send({
      name: "Abcd",
      slug: "test-live",
      businessType: "Spa",
      email: "abcd@local",
      ownerName: "Owner Name",
      ownerEmail: "owner@local",
      ownerPassword: "password",
      featureFlags: { pos: true }
    });

    expect(response.status).toBe(201);
    expect(prismaMock.salon.create).toHaveBeenCalled();
  });

  it("returns a clean conflict for duplicate plan names", async () => {
    prismaMock.plan.create.mockRejectedValue({
      code: "P2002",
      meta: { target: "Plan_name_key" }
    });

    const response = await request(buildApp()).post("/super-admin/plans").send({
      name: "Growth",
      monthlyPrice: 3999,
      yearlyPrice: 9999,
      trialDays: 7,
      branchLimit: 1,
      userLimit: 5,
      customerLimit: 400,
      invoiceLimit: 1000,
      storageLimit: 5,
      featureFlags: { pos: true, reports: true, crm: true }
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already exists/i);
  });

  it("returns a clean conflict for duplicate salon slugs during update", async () => {
    prismaMock.salon.update.mockRejectedValue({
      code: "P2002",
      meta: { target: "Salon_slug_key" }
    });

    const response = await request(buildApp()).patch("/super-admin/salons/salon-1").send({
      name: "Demo Salon",
      slug: "demo-salon",
      email: "demo@salon.local",
      featureFlags: { pos: true }
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already exists/i);
  });

  it("returns readable validation messages for invalid plan input", async () => {
    const response = await request(buildApp()).post("/super-admin/plans").send({
      name: "",
      monthlyPrice: -1,
      yearlyPrice: 0,
      trialDays: 7,
      branchLimit: 1,
      userLimit: 5,
      customerLimit: 400,
      invoiceLimit: 1000,
      featureFlags: {}
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("name: Name is required");
    expect(response.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "name", message: "Name is required" }),
        expect.objectContaining({ field: "monthlyPrice", message: "Monthly Price must be at least 0" })
      ])
    );
  });

  it("blocks invalid subscription dates before Prisma create runs", async () => {
    const response = await request(buildApp()).post("/super-admin/subscriptions").send({
      salonId: "salon-1234",
      planId: "plan-1234",
      status: "ACTIVE",
      paymentStatus: "PAID",
      startsAt: "",
      endsAt: ""
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("startsAt: Start Date is required");
    expect(prismaMock.subscription.create).not.toHaveBeenCalled();
  });

  it("ignores helper-only settings fields before Prisma update", async () => {
    prismaMock.globalSetting.findFirst.mockResolvedValue({ id: "setting-1" });
    prismaMock.globalSetting.update.mockImplementation(async ({ data }) => ({ id: "setting-1", ...data }));

    const response = await request(buildApp()).post("/super-admin/settings").send({
      systemName: "ReSpark Clone SaaS",
      maintenanceMode: false,
      taxLabel: "Tax",
      defaultCurrency: "PKR",
      currencyOptions: ["PKR", "USD"],
      notificationDefaults: { email: true },
      notificationDefaultsText: "{\"email\":true}",
      invoicePrefix: "INV"
    });

    expect(response.status).toBe(200);
    expect(prismaMock.globalSetting.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ notificationDefaultsText: "{\"email\":true}" })
    }));
    expect(response.body.notificationDefaults).toEqual({ email: true });
  });
});
