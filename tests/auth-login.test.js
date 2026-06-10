import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET = "test-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

const prismaMock = {
  user: { findUnique: vi.fn() },
  globalSetting: { findFirst: vi.fn() },
  salon: { findUnique: vi.fn() },
  subscription: { findFirst: vi.fn() }
};

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/trialCleanup.js", () => ({
  runExpiredDemoCleanup: vi.fn().mockResolvedValue({ cleaned: 0, subscriptions: [] })
}));
vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn().mockResolvedValue(true), hash: vi.fn() },
  compare: vi.fn().mockResolvedValue(true),
  hash: vi.fn()
}));

const { authRouter } = await import("../src/modules/auth/routes.js");
const { errorHandler } = await import("../src/middlewares/error.js");
const { signLoginAccessToken } = await import("../src/lib/tokens.js");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  app.use(errorHandler);
  return app;
};

describe("auth login", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset();
    prismaMock.globalSetting.findFirst.mockReset();
    prismaMock.salon.findUnique.mockReset();
    prismaMock.subscription.findFirst.mockReset();
  });

  it("logs salon users in by resolving their active membership from email", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Salon User",
      email: "owner@test.com",
      passwordHash: "hashed",
      systemRole: "SALON_USER",
      memberships: [{
        salonId: "salon-1",
        salonRole: "SALON_OWNER",
        permissions: {},
        createdAt: new Date("2026-01-01"),
        salon: { id: "salon-1", status: "ACTIVE", featureFlags: { pos: true } }
      }]
    });
    prismaMock.globalSetting.findFirst.mockResolvedValue(null);
    prismaMock.salon.findUnique.mockResolvedValue({ name: "Demo Salon", featureFlags: { pos: true } });
    prismaMock.subscription.findFirst.mockResolvedValue(null);

    const response = await request(buildApp()).post("/auth/login").send({
      email: "owner@test.com",
      password: "secret123"
    });

    expect(response.status).toBe(200);
    expect(response.body.membership.salonId).toBe("salon-1");
  });

  it("blocks login while password setup is pending", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Demo Owner",
      email: "owner@test.com",
      passwordHash: "hashed",
      systemRole: "SALON_USER",
      passwordSetupRequired: true,
      memberships: [{ salonId: "salon-1", salonRole: "SALON_OWNER", permissions: {}, salon: { id: "salon-1", status: "ACTIVE", featureFlags: {} } }]
    });

    const response = await request(buildApp()).post("/auth/login").send({
      email: "owner@test.com",
      password: "secret123"
    });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/Password setup is still pending/i);
  });

  it("blocks inactive users before any salon membership resolution", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Inactive Staff",
      email: "owner@test.com",
      passwordHash: "hashed",
      systemRole: "SALON_USER",
      isActive: false,
      memberships: [{
        salonId: "salon-1",
        salonRole: "STAFF",
        permissions: {},
        salon: { id: "salon-1", status: "ACTIVE", featureFlags: {} }
      }]
    });

    const response = await request(buildApp()).post("/auth/login").send({
      email: "owner@test.com",
      password: "secret123"
    });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/inactive/i);
  });

  it("blocks salon users without matching membership", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Salon User",
      email: "owner@test.com",
      passwordHash: "hashed",
      systemRole: "SALON_USER",
      memberships: []
    });
    prismaMock.globalSetting.findFirst.mockResolvedValue(null);

    const response = await request(buildApp()).post("/auth/login").send({
      email: "owner@test.com",
      password: "secret123"
    });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/No active salon membership/i);
  });

  it("blocks salon users whose only membership belongs to a suspended salon", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Suspended Owner",
      email: "owner@test.com",
      passwordHash: "hashed",
      systemRole: "SALON_USER",
      memberships: [{
        salonId: "salon-1",
        salonRole: "SALON_OWNER",
        permissions: {},
        salon: { id: "salon-1", status: "SUSPENDED", featureFlags: {} }
      }]
    });
    prismaMock.globalSetting.findFirst.mockResolvedValue(null);

    const response = await request(buildApp()).post("/auth/login").send({
      email: "owner@test.com",
      password: "secret123"
    });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/No active salon membership/i);
  });

  it("blocks non-super-admin login during maintenance mode", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Salon User",
      email: "owner@test.com",
      passwordHash: "hashed",
      systemRole: "SALON_USER",
      memberships: [{
        salonId: "salon-1",
        salonRole: "SALON_OWNER",
        permissions: {},
        salon: { id: "salon-1", status: "ACTIVE", featureFlags: {} }
      }]
    });
    prismaMock.globalSetting.findFirst.mockResolvedValue({ maintenanceMode: true });

    const response = await request(buildApp()).post("/auth/login").send({
      email: "owner@test.com",
      password: "secret123"
    });

    expect(response.status).toBe(503);
    expect(response.body.message).toMatch(/maintenance mode/i);
  });

  it("blocks demo accounts without secure login link token", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Demo Owner",
      email: "owner@test.com",
      passwordHash: "hashed",
      systemRole: "SALON_USER",
      passwordSetupRequired: false,
      isDemoAccount: true,
      memberships: [{ salonId: "salon-1", salonRole: "SALON_OWNER", permissions: {}, createdAt: new Date("2026-01-01"), salon: { id: "salon-1", status: "ACTIVE", featureFlags: {} } }]
    });
    prismaMock.globalSetting.findFirst.mockResolvedValue(null);
    prismaMock.salon.findUnique.mockResolvedValue({ name: "Demo Salon", featureFlags: {} });
    prismaMock.subscription.findFirst.mockResolvedValue(null);

    const response = await request(buildApp()).post("/auth/login").send({
      email: "owner@test.com",
      password: "secret123"
    });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/secure login link/i);
  });

  it("accepts demo accounts from the secure email link without a salonId field", async () => {
    const loginAccessToken = signLoginAccessToken({
      userId: "user-1",
      email: "owner@test.com",
      salonId: "salon-1"
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Demo Owner",
      email: "owner@test.com",
      passwordHash: "hashed",
      systemRole: "SALON_USER",
      passwordSetupRequired: false,
      isDemoAccount: true,
      memberships: [{ salonId: "salon-1", salonRole: "SALON_OWNER", permissions: {}, createdAt: new Date("2026-01-01"), salon: { id: "salon-1", status: "ACTIVE", featureFlags: {} } }]
    });
    prismaMock.globalSetting.findFirst.mockResolvedValue(null);
    prismaMock.salon.findUnique.mockResolvedValue({ name: "Demo Salon", featureFlags: {} });
    prismaMock.subscription.findFirst.mockResolvedValue(null);

    const response = await request(buildApp()).post("/auth/login").send({
      email: "owner@test.com",
      password: "secret123",
      loginAccessToken
    });

    expect(response.status).toBe(200);
    expect(response.body.membership.salonId).toBe("salon-1");
  });
});
