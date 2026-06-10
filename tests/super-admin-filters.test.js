import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  salon: { findMany: vi.fn(), count: vi.fn() },
  plan: { findMany: vi.fn() },
  subscription: { findMany: vi.fn() },
  payment: { findMany: vi.fn() },
  demoLead: { findMany: vi.fn(), count: vi.fn() },
  supportTicket: { findMany: vi.fn(), count: vi.fn() }
};

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const { superAdminRouter } = await import("../src/modules/superAdmin/routes.js");
const { errorHandler } = await import("../src/middlewares/error.js");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: "super-1",
      userId: "super-1",
      name: "Super Admin",
      systemRole: "SUPER_ADMIN",
      featureFlags: {},
      permissions: {}
    };
    next();
  });
  app.use("/super-admin", superAdminRouter);
  app.use(errorHandler);
  return app;
};

describe("super admin filters", () => {
  beforeEach(() => {
    prismaMock.salon.findMany.mockReset();
    prismaMock.salon.count.mockReset();
    prismaMock.plan.findMany.mockReset();
    prismaMock.subscription.findMany.mockReset();
    prismaMock.payment.findMany.mockReset();
    prismaMock.demoLead.findMany.mockReset();
    prismaMock.demoLead.count.mockReset();
    prismaMock.supportTicket.findMany.mockReset();
    prismaMock.supportTicket.count.mockReset();

    prismaMock.salon.findMany.mockResolvedValue([]);
    prismaMock.salon.count.mockResolvedValue(0);
    prismaMock.plan.findMany.mockResolvedValue([]);
    prismaMock.subscription.findMany.mockResolvedValue([]);
    prismaMock.payment.findMany.mockResolvedValue([]);
    prismaMock.demoLead.findMany.mockResolvedValue([]);
    prismaMock.demoLead.count.mockResolvedValue(0);
    prismaMock.supportTicket.findMany.mockResolvedValue([]);
    prismaMock.supportTicket.count.mockResolvedValue(0);
  });

  it("passes salon search and status filters to the database query", async () => {
    const response = await request(buildApp()).get("/super-admin/salons?q=lahore&status=ACTIVE");

    expect(response.status).toBe(200);
    expect(prismaMock.salon.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "ACTIVE",
        OR: expect.arrayContaining([
          expect.objectContaining({ name: { contains: "lahore", mode: "insensitive" } }),
          expect.objectContaining({ slug: { contains: "lahore", mode: "insensitive" } })
        ])
      })
    }));
  });

  it("passes subscription search, status, and payment filters to the database query", async () => {
    const response = await request(buildApp()).get("/super-admin/subscriptions?q=growth&status=TRIAL&paymentStatus=PENDING");

    expect(response.status).toBe(200);
    expect(prismaMock.subscription.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "TRIAL",
        paymentStatus: "PENDING",
        OR: expect.arrayContaining([
          expect.objectContaining({ salon: { is: { name: { contains: "growth", mode: "insensitive" } } } }),
          expect.objectContaining({ plan: { is: { name: { contains: "growth", mode: "insensitive" } } } })
        ])
      })
    }));
  });

  it("passes demo lead search and status filters to the database query", async () => {
    const response = await request(buildApp()).get("/super-admin/demo-leads?q=owner&status=PENDING");

    expect(response.status).toBe(200);
    expect(prismaMock.demoLead.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "PENDING",
        OR: expect.arrayContaining([
          expect.objectContaining({ name: { contains: "owner", mode: "insensitive" } }),
          expect.objectContaining({ email: { contains: "owner", mode: "insensitive" } })
        ])
      })
    }));
  });

  it("passes support ticket search, status, and priority filters to the database query", async () => {
    const response = await request(buildApp()).get("/super-admin/support-tickets?q=billing&status=OPEN&priority=HIGH");

    expect(response.status).toBe(200);
    expect(prismaMock.supportTicket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: "OPEN",
        priority: "HIGH",
        OR: expect.arrayContaining([
          expect.objectContaining({ title: { contains: "billing", mode: "insensitive" } }),
          expect.objectContaining({ description: { contains: "billing", mode: "insensitive" } })
        ])
      })
    }));
  });

  it("keeps dashboard period query in the response contract", async () => {
    const response = await request(buildApp()).get("/super-admin/dashboard?period=year");

    expect(response.status).toBe(200);
    expect(response.body.period).toBe("year");
  });

  it("filters super admin audit log feed by query and type", async () => {
    prismaMock.salon.findMany.mockResolvedValue([
      { id: "salon-1", name: "Lahore Glow", status: "ACTIVE", createdAt: new Date("2026-01-01T00:00:00Z") }
    ]);
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        id: "sub-1",
        status: "ACTIVE",
        paymentStatus: "PAID",
        startsAt: new Date("2026-02-01T00:00:00Z"),
        salon: { name: "Lahore Glow" },
        plan: { name: "Growth" }
      }
    ]);
    prismaMock.payment.findMany.mockResolvedValue([]);
    prismaMock.supportTicket.findMany.mockResolvedValue([]);
    prismaMock.demoLead.findMany.mockResolvedValue([]);

    const response = await request(buildApp()).get("/super-admin/audit-logs?q=growth&type=SUBSCRIPTION_UPDATED");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].type).toBe("SUBSCRIPTION_UPDATED");
    expect(response.body[0].action).toMatch(/Growth/i);
  });
});
