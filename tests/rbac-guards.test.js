import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  globalSetting: { findFirst: vi.fn() }
};

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const {
  requireAuth,
  requireCustomerAuth,
  requireFeatureEnabled,
  requireMaintenanceAccess,
  requireSalonContext,
  requireSalonPermission,
  requireSystemRole
} = await import("../src/middlewares/rbac.js");

const buildOwnerApp = (user) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.get(
    "/owner/protected",
    requireAuth,
    requireMaintenanceAccess,
    requireSalonContext,
    requireFeatureEnabled("reports"),
    requireSalonPermission("reports", "view"),
    (_req, res) => res.json({ ok: true })
  );
  return app;
};

const buildSuperAdminApp = (user) => {
  const app = express();
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.get("/super-admin/protected", requireAuth, requireSystemRole("SUPER_ADMIN"), (_req, res) => res.json({ ok: true }));
  return app;
};

const buildCustomerApp = (user) => {
  const app = express();
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.get("/customer/protected", requireCustomerAuth, (_req, res) => res.json({ ok: true }));
  return app;
};

describe("rbac guards", () => {
  beforeEach(() => {
    prismaMock.globalSetting.findFirst.mockReset();
    prismaMock.globalSetting.findFirst.mockResolvedValue(null);
  });

  it("blocks owner-style routes when no authenticated user exists", async () => {
    const response = await request(buildOwnerApp(null)).get("/owner/protected");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized");
  });

  it("blocks salon users without salon context on owner-style routes", async () => {
    const response = await request(buildOwnerApp({
      userId: "user-1",
      systemRole: "SALON_USER",
      featureFlags: { reports: true },
      permissions: { reports: ["view"] }
    })).get("/owner/protected");

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Salon context required");
  });

  it("blocks salon users during maintenance mode on owner-style routes", async () => {
    prismaMock.globalSetting.findFirst.mockResolvedValue({ maintenanceMode: true });

    const response = await request(buildOwnerApp({
      userId: "user-1",
      salonId: "salon-1",
      systemRole: "SALON_USER",
      featureFlags: { reports: true },
      permissions: { reports: ["view"] }
    })).get("/owner/protected");

    expect(response.status).toBe(503);
    expect(response.body.message).toMatch(/maintenance mode/i);
  });

  it("blocks owner-style routes when the feature is disabled", async () => {
    const response = await request(buildOwnerApp({
      userId: "user-1",
      salonId: "salon-1",
      systemRole: "SALON_USER",
      featureFlags: { reports: false },
      permissions: { reports: ["view"] }
    })).get("/owner/protected");

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Feature disabled: reports");
  });

  it("blocks owner-style routes when the role permission is missing", async () => {
    const response = await request(buildOwnerApp({
      userId: "user-1",
      salonId: "salon-1",
      systemRole: "SALON_USER",
      featureFlags: { reports: true },
      permissions: { reports: [] }
    })).get("/owner/protected");

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("No permission: reports.view");
  });

  it("lets super admins bypass salon-owner feature and permission guards", async () => {
    prismaMock.globalSetting.findFirst.mockResolvedValue({ maintenanceMode: true });

    const response = await request(buildOwnerApp({
      userId: "super-1",
      systemRole: "SUPER_ADMIN",
      featureFlags: { reports: false },
      permissions: {}
    })).get("/owner/protected");

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it("blocks salon users from super-admin routes", async () => {
    const response = await request(buildSuperAdminApp({
      userId: "user-1",
      systemRole: "SALON_USER"
    })).get("/super-admin/protected");

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Forbidden");
  });

  it("allows customers through customer-only guards and blocks salon users", async () => {
    const customerResponse = await request(buildCustomerApp({
      userId: "customer-user-1",
      systemRole: "CUSTOMER",
      customerId: "customer-1",
      salonId: "salon-1"
    })).get("/customer/protected");

    expect(customerResponse.status).toBe(200);
    expect(customerResponse.body.ok).toBe(true);

    const salonUserResponse = await request(buildCustomerApp({
      userId: "user-1",
      systemRole: "SALON_USER",
      salonId: "salon-1"
    })).get("/customer/protected");

    expect(salonUserResponse.status).toBe(403);
    expect(salonUserResponse.body.message).toBe("Customer access only");
  });
});
