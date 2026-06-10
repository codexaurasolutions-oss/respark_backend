import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  globalSetting: { findFirst: vi.fn() },
  subscription: { findFirst: vi.fn() },
  stockTransfer: { create: vi.fn() }
};

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const { ownerRouter } = await import("../src/modules/owner/routes.js");
const { errorHandler } = await import("../src/middlewares/error.js");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = {
      id: "owner-user",
      userId: "owner-user",
      name: "Owner User",
      systemRole: "SALON_USER",
      salonId: "salon-1",
      permissions: { purchases: ["view", "create", "edit"], inventory: ["view", "create", "edit"] },
      featureFlags: { inventory: true }
    };
    next();
  });
  app.use("/owner", ownerRouter);
  app.use(errorHandler);
  return app;
};

describe("owner inventory transfers", () => {
  beforeEach(() => {
    prismaMock.globalSetting.findFirst.mockResolvedValue(null);
    prismaMock.subscription.findFirst.mockResolvedValue(null);
    prismaMock.stockTransfer.create.mockReset();
  });

  it("rejects transfers where source and destination branch are the same", async () => {
    const response = await request(buildApp()).post("/owner/purchases/transfers").send({
      fromBranchId: "branch-1",
      toBranchId: "branch-1",
      note: "same branch",
      items: [{ productId: "product-1", quantity: 1 }]
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Destination branch must be different from the source branch");
    expect(prismaMock.stockTransfer.create).not.toHaveBeenCalled();
  });
});
