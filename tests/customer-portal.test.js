import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  salon: {
    findUnique: vi.fn()
  },
  catalogSetting: {
    findFirst: vi.fn()
  },
  subscription: {
    findFirst: vi.fn()
  },
  customer: {
    findFirst: vi.fn()
  },
  customerNotification: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  }
};

const compareMock = vi.fn();

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/phase3.js", async () => {
  const actual = await vi.importActual("../src/lib/phase3.js");
  return {
    ...actual,
    createOnlineOrder: vi.fn()
  };
});
vi.mock("../src/lib/phase2.js", () => ({
  checkStaffAvailability: vi.fn(),
  ensureScopedStaffMembership: vi.fn()
}));
vi.mock("../src/lib/tokens.js", () => ({
  signAccessToken: vi.fn(() => "access-token"),
  signRefreshToken: vi.fn(() => "refresh-token")
}));
vi.mock("bcryptjs", () => ({
  default: {
    compare: compareMock,
    hash: vi.fn()
  }
}));
vi.mock("../src/middlewares/rbac.js", () => ({
  requireCustomerAuth: (req, res, next) => {
    req.user = {
      userId: "user-1",
      customerId: "customer-1",
      salonId: "salon-1",
      systemRole: "CUSTOMER"
    };
    next();
  }
}));

const { customerRouter } = await import("../src/modules/customer/routes.js");
const { errorHandler } = await import("../src/middlewares/error.js");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/customer", customerRouter);
  app.use(errorHandler);
  return app;
};

describe("customer portal contract", () => {
  beforeEach(() => {
    for (const model of Object.values(prismaMock)) {
      for (const fn of Object.values(model)) {
        fn.mockReset?.();
      }
    }
    compareMock.mockReset();
  });

  it("returns salon storefront context on login", async () => {
    prismaMock.salon.findUnique
      .mockResolvedValueOnce({ id: "salon-1", name: "Demo Salon", slug: "demo-salon", featureFlags: {} })
      .mockResolvedValueOnce({ id: "salon-1", featureFlags: {} })
      .mockResolvedValueOnce({ id: "salon-1", name: "Demo Salon", slug: "demo-salon" });
    prismaMock.subscription.findFirst.mockResolvedValue({
      status: "ACTIVE",
      plan: { featureFlags: { customerPortal: true } }
    });
    prismaMock.customer.findFirst.mockResolvedValue({
      id: "customer-1",
      salonId: "salon-1",
      phone: "+923001112233",
      user: {
        id: "user-1",
        name: "Portal Customer",
        systemRole: "CUSTOMER",
        passwordHash: "hashed"
      }
    });
    prismaMock.catalogSetting.findFirst.mockResolvedValue({ customSlug: "demo-store" });
    compareMock.mockResolvedValue(true);

    const response = await request(buildApp()).post("/customer/login").send({
      salonSlug: "demo-salon",
      emailOrPhone: "+923001112233",
      password: "Password@123"
    });

    expect(response.status).toBe(200);
    expect(response.body.customer).toEqual(expect.objectContaining({
      id: "customer-1",
      salonId: "salon-1",
      salonName: "Demo Salon",
      salonSlug: "demo-salon",
      storefrontSlug: "demo-store",
      catalogLink: expect.stringContaining("/salon/demo-store")
    }));
  });

  it("returns portal context with profile payload", async () => {
    prismaMock.salon.findUnique
      .mockResolvedValueOnce({ id: "salon-1", featureFlags: {} })
      .mockResolvedValueOnce({ id: "salon-1", name: "Demo Salon", slug: "demo-salon" });
    prismaMock.subscription.findFirst.mockResolvedValue({
      status: "ACTIVE",
      plan: { featureFlags: { customerPortal: true } }
    });
    prismaMock.customer.findFirst.mockResolvedValue({
      id: "customer-1",
      salonId: "salon-1",
      name: "Portal Customer",
      phone: "+923001112233",
      email: "customer@test.local"
    });
    prismaMock.catalogSetting.findFirst.mockResolvedValue({ customSlug: "demo-store" });

    const response = await request(buildApp()).get("/customer/profile");

    expect(response.status).toBe(200);
    expect(response.body.portalContext).toEqual(expect.objectContaining({
      salonName: "Demo Salon",
      salonSlug: "demo-salon",
      storefrontSlug: "demo-store"
    }));
  });

  it("marks customer notifications as read", async () => {
    prismaMock.salon.findUnique.mockResolvedValue({ id: "salon-1", featureFlags: {} });
    prismaMock.subscription.findFirst.mockResolvedValue({
      status: "ACTIVE",
      plan: { featureFlags: { customerPortal: true } }
    });
    prismaMock.customerNotification.findFirst.mockResolvedValue({
      id: "cn-1",
      salonId: "salon-1",
      customerId: "customer-1",
      isRead: false
    });
    prismaMock.customerNotification.update.mockResolvedValue({
      id: "cn-1",
      isRead: true
    });
    prismaMock.customerNotification.updateMany.mockResolvedValue({ count: 2 });

    const singleResponse = await request(buildApp()).patch("/customer/notifications/cn-1/read");
    expect(singleResponse.status).toBe(200);
    expect(singleResponse.body.isRead).toBe(true);

    const allResponse = await request(buildApp()).patch("/customer/notifications/read-all");
    expect(allResponse.status).toBe(200);
    expect(allResponse.body.ok).toBe(true);
    expect(prismaMock.customerNotification.updateMany).toHaveBeenCalledWith({
      where: {
        salonId: "salon-1",
        customerId: "customer-1"
      },
      data: { isRead: true }
    });
  });
});
