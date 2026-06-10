import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  salon: {
    findUnique: vi.fn()
  },
  catalogSetting: {
    findFirst: vi.fn()
  },
  appointmentSetting: {
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  ecommerceSetting: {
    findUnique: vi.fn()
  }
};

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const {
  resolvePublicSalonBySlug,
  ensurePublicStoreEnabled,
  ensurePublicBookingEnabled
} = await import("../src/lib/phase3.js");

describe("phase3 public helpers", () => {
  beforeEach(() => {
    prismaMock.salon.findUnique.mockReset();
    prismaMock.catalogSetting.findFirst.mockReset();
    prismaMock.appointmentSetting.findFirst.mockReset();
    prismaMock.appointmentSetting.findMany.mockReset();
    prismaMock.ecommerceSetting.findUnique.mockReset();
  });

  it("resolves public salon by custom slug", async () => {
    prismaMock.salon.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "salon-1",
        slug: "demo-salon",
        status: "ACTIVE",
        featureFlags: { publicCatalog: true, digitalCatalog: true },
        branches: [],
        catalogSettings: [{ branchId: null, customSlug: "demo-custom", catalogEnabled: true }],
        ecommerceSettings: []
      });
    prismaMock.catalogSetting.findFirst.mockResolvedValue({ salonId: "salon-1" });
    prismaMock.appointmentSetting.findMany.mockResolvedValue([]);

    const result = await resolvePublicSalonBySlug("demo-custom");

    expect(result.salon.id).toBe("salon-1");
    expect(result.catalogSettings.customSlug).toBe("demo-custom");
  });

  it("blocks public store when ecommerce feature is disabled", async () => {
    prismaMock.salon.findUnique.mockResolvedValue({
      id: "salon-1",
      status: "ACTIVE",
      featureFlags: { ecommerce: false }
    });
    prismaMock.ecommerceSetting.findUnique.mockResolvedValue({ salonId: "salon-1", storeEnabled: true });

    await expect(ensurePublicStoreEnabled("salon-1")).rejects.toMatchObject({
      status: 403,
      message: "E-commerce store is disabled for this salon"
    });
  });

  it("blocks public booking when online booking is disabled", async () => {
    prismaMock.salon.findUnique.mockResolvedValue({
      id: "salon-1",
      status: "ACTIVE",
      featureFlags: { appointments: true }
    });
    prismaMock.appointmentSetting.findFirst
      .mockResolvedValueOnce({ salonId: "salon-1", branchId: "branch-1", onlineBookingEnabled: false })
      .mockResolvedValueOnce({ salonId: "salon-1", branchId: null, onlineBookingEnabled: false })
      .mockResolvedValueOnce({ salonId: "salon-1", branchId: "branch-1", onlineBookingEnabled: false });

    await expect(ensurePublicBookingEnabled("salon-1", "branch-1")).rejects.toMatchObject({
      status: 403,
      message: "Online booking is disabled for this salon"
    });
  });
});
