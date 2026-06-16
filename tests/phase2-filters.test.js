import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  appointment: { findMany: vi.fn() },
  product: { findMany: vi.fn() },
  stockMovement: { findMany: vi.fn() },
  invoice: { findMany: vi.fn() },
  payment: { findMany: vi.fn() }
};

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/phase2.js", () => ({
  normalizeBranchId: (value) => (value ? String(value) : null),
  attachBranchStock: vi.fn(async (_tx, rows) => rows),
  createStockMovement: vi.fn(),
  toAmount: (value) => Number(value || 0)
}));
vi.mock("../src/modules/owner/phase2/shared.js", () => ({
  buildAppointmentScope: vi.fn((_req, branchId) => ({ salonId: "salon-1", ...(branchId ? { branchId } : {}) })),
  fetchAppointment: vi.fn(),
  canAccessAppointment: vi.fn(() => true),
  logAppointmentChange: vi.fn(),
  nextNumber: vi.fn(),
  assignAppointmentItems: vi.fn()
}));

const { registerAppointmentRoutes } = await import("../src/modules/owner/phase2/appointments.js");
const { registerInventoryRoutes } = await import("../src/modules/owner/phase2/inventory.js");
const { registerBillingRoutes } = await import("../src/modules/owner/phase2/billing.js");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: "owner-1",
      userId: "owner-1",
      name: "Owner",
      salonRole: "SALON_OWNER",
      permissions: {
        appointments: ["view"],
        inventory: ["view"],
        purchases: ["view"],
        invoices: ["view"],
        payments: ["view"]
      },
      featureFlags: {
        appointments: true,
        inventory: true,
        pos: true
      }
    };
    req.salonId = "salon-1";
    next();
  });
  const router = express.Router();
  registerAppointmentRoutes(router);
  registerInventoryRoutes(router);
  registerBillingRoutes(router);
  app.use("/owner", router);
  return app;
};

describe("phase2 filters", () => {
  beforeEach(() => {
    prismaMock.appointment.findMany.mockReset();
    prismaMock.product.findMany.mockReset();
    prismaMock.stockMovement.findMany.mockReset();
    prismaMock.invoice.findMany.mockReset();
    prismaMock.payment.findMany.mockReset();
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.stockMovement.findMany.mockResolvedValue([]);
    prismaMock.invoice.findMany.mockResolvedValue([]);
    prismaMock.payment.findMany.mockResolvedValue([]);
  });

  it("passes dynamic appointment list filters to the database query", async () => {
    const response = await request(buildApp()).get("/owner/appointments").query({
      branchId: "branch-1",
      status: "CONFIRMED",
      bookingChannel: "PHONE",
      customerId: "customer-1",
      from: "2026-06-01T09:00:00.000Z",
      to: "2026-06-05T18:00:00.000Z"
    });

    expect(response.status).toBe(200);
    expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        salonId: "salon-1",
        branchId: "branch-1",
        status: "CONFIRMED",
        bookingChannel: "PHONE",
        customerId: "customer-1",
        AND: expect.arrayContaining([
          expect.objectContaining({
            startAt: expect.objectContaining({
              lte: new Date("2026-06-05T18:00:00.000Z")
            })
          }),
          expect.objectContaining({
            endAt: expect.objectContaining({
              gte: new Date("2026-06-01T09:00:00.000Z")
            })
          })
        ])
      })
    }));
  });

  it("passes inventory search and category filters to product and low-stock queries", async () => {
    const response = await request(buildApp()).get("/owner/inventory/products").query({
      branchId: "branch-1",
      q: "serum",
      categoryId: "category-1",
      productType: "RETAIL"
    });

    expect(response.status).toBe(200);
    expect(prismaMock.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        salonId: "salon-1",
        categoryId: "category-1",
        productType: "RETAIL",
        isActive: true,
        OR: expect.arrayContaining([
          expect.objectContaining({ name: { contains: "serum" } }),
          expect.objectContaining({ sku: { contains: "serum" } }),
          expect.objectContaining({ barcode: { contains: "serum" } })
        ])
      })
    }));
  });

  it("passes movement filters to the stock movement query", async () => {
    const response = await request(buildApp()).get("/owner/inventory/stock-movements").query({
      branchId: "branch-1",
      productId: "product-1",
      movementType: "TRANSFER_OUT"
    });

    expect(response.status).toBe(200);
    expect(prismaMock.stockMovement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        salonId: "salon-1",
        branchId: "branch-1",
        productId: "product-1",
        movementType: "TRANSFER_OUT"
      })
    }));
  });

  it("passes invoice and payment search filters to the database query", async () => {
    const invoiceResponse = await request(buildApp()).get("/owner/invoices").query({
      branchId: "branch-1",
      status: "PAID",
      q: "sara"
    });

    expect(invoiceResponse.status).toBe(200);
    expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        salonId: "salon-1",
        branchId: "branch-1",
        status: "PAID",
        OR: expect.arrayContaining([
          expect.objectContaining({ invoiceNumber: { contains: "sara" } }),
          expect.objectContaining({ customer: { is: { name: { contains: "sara" } } } })
        ])
      })
    }));

    const paymentResponse = await request(buildApp()).get("/owner/payments").query({
      branchId: "branch-1",
      mode: "CASH",
      type: "PAYMENT",
      q: "note"
    });

    expect(paymentResponse.status).toBe(200);
    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        salonId: "salon-1",
        mode: "CASH",
        type: "PAYMENT",
        OR: expect.arrayContaining([
          expect.objectContaining({ note: { contains: "note" } }),
          expect.objectContaining({ invoice: { is: { invoiceNumber: { contains: "note" } } } })
        ])
      })
    }));
  });
});
