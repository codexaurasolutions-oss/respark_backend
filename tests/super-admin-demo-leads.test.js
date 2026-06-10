import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  demoLead: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  }
};

const approveDemoLeadMock = vi.fn();
const resendDemoInviteMock = vi.fn();

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/demoInvites.js", () => ({
  approveDemoLead: approveDemoLeadMock,
  resendDemoInvite: resendDemoInviteMock
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

describe("super admin demo lead workflow", () => {
  beforeEach(() => {
    approveDemoLeadMock.mockReset();
    resendDemoInviteMock.mockReset();
    prismaMock.demoLead.findMany.mockReset();
    prismaMock.demoLead.findUnique.mockReset();
    prismaMock.demoLead.update.mockReset();
  });

  it("approves a demo lead and returns invite payload", async () => {
    approveDemoLeadMock.mockResolvedValue({
      leadId: "lead-1",
      salon: { id: "salon-1", name: "Demo Salon" },
      owner: { email: "lead@test.com" },
      delivery: { mode: "json" }
    });

    const response = await request(buildApp()).post("/super-admin/demo-leads/lead-1/approve").send({
      salonName: "Demo Salon",
      businessType: "Salon",
      trialDays: 7,
      reviewNote: "Approved"
    });

    expect(response.status).toBe(201);
    expect(response.body.salon.id).toBe("salon-1");
    expect(approveDemoLeadMock).toHaveBeenCalledWith(expect.objectContaining({
      leadId: "lead-1",
      actorName: "Super Admin"
    }));
  });

  it("rejects a pending lead with review note", async () => {
    prismaMock.demoLead.findUnique.mockResolvedValue({
      id: "lead-2",
      status: "PENDING"
    });
    prismaMock.demoLead.update.mockResolvedValue({
      id: "lead-2",
      status: "REJECTED",
      reviewNote: "Not a fit"
    });

    const response = await request(buildApp()).post("/super-admin/demo-leads/lead-2/reject").send({
      reviewNote: "Not a fit"
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("REJECTED");
    expect(prismaMock.demoLead.update).toHaveBeenCalled();
  });
});
