import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  catalogSetting: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn()
  }
};

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const { registerCatalogRoutes } = await import("../src/modules/owner/phase3/catalog.js");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      userId: "owner-1",
      name: "Owner",
      systemRole: "SALON_USER",
      salonId: "salon-1",
      featureFlags: {
        digitalCatalog: true
      },
      permissions: {
        catalog: ["view", "edit"]
      }
    };
    req.salonId = req.user.salonId;
    next();
  });
  const router = express.Router();
  registerCatalogRoutes(router);
  app.use("/owner", router);
  return app;
};

describe("phase3 catalog routes", () => {
  beforeEach(() => {
    prismaMock.catalogSetting.findFirst.mockReset();
    prismaMock.catalogSetting.update.mockReset();
    prismaMock.catalogSetting.create.mockReset();
  });

  it("saves before/after gallery through catalog settings", async () => {
    prismaMock.catalogSetting.findFirst.mockResolvedValue(null);
    prismaMock.catalogSetting.create.mockImplementation(async ({ data }) => ({ id: "catalog-1", ...data }));

    const gallery = [
      {
        title: "Keratin Smooth",
        serviceName: "Hair Treatment",
        beforeImageUrl: "https://example.com/before.jpg",
        afterImageUrl: "https://example.com/after.jpg",
        resultNote: "Shine restored"
      }
    ];

    const response = await request(buildApp()).post("/owner/catalog/settings").send({
      catalogEnabled: true,
      beforeAfterGallery: gallery
    });

    expect(response.status).toBe(201);
    expect(prismaMock.catalogSetting.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        salonId: "salon-1",
        beforeAfterGallery: gallery
      })
    }));
  });
});
