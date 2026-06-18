import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  demoLead: {
    create: vi.fn()
  },
  globalSetting: {
    findFirst: vi.fn()
  },
  plan: {
    findMany: vi.fn()
  },
  salon: {
    findUnique: vi.fn()
  },
  service: {
    findMany: vi.fn()
  }
};

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const { publicRouter } = await import("../src/modules/public/routes.js");
const { errorHandler } = await import("../src/middlewares/error.js");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/public", publicRouter);
  app.use(errorHandler);
  return app;
};

describe("public single-salon routes", () => {
  beforeEach(() => {
    prismaMock.demoLead.create.mockReset();
    prismaMock.globalSetting.findFirst.mockReset();
    prismaMock.plan.findMany.mockReset();
    prismaMock.salon.findUnique.mockReset();
    prismaMock.service.findMany.mockReset();
  });

  it("returns maintenanceMode in public settings payload", async () => {
    prismaMock.globalSetting.findFirst.mockResolvedValue({
      systemName: "ReSpark QA",
      maintenanceMode: true,
      contactEmail: "hello@test.local"
    });

    const response = await request(buildApp()).get("/public/settings");

    expect(response.status).toBe(200);
    expect(response.body.maintenanceMode).toBe(true);
    expect(response.body.systemName).toBe("ReSpark QA");
  });

  it("does not expose the old public demo lead endpoint anymore", async () => {
    const response = await request(buildApp()).post("/public/demo-leads").send({
      name: "QA Lead",
      email: "qa@example.com",
      phone: "+923001234567",
      company: "QA Salon",
      message: "Need demo"
    });

    expect(response.status).toBe(404);
    expect(prismaMock.demoLead.create).not.toHaveBeenCalled();
  });
});
