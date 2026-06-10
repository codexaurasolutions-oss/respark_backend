import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  globalSetting: { findFirst: vi.fn() },
  supportTicket: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  supportTicketMessage: {
    create: vi.fn()
  },
  supportTicketEvent: {
    create: vi.fn()
  },
  $transaction: vi.fn()
};

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));

const { ownerRouter } = await import("../src/modules/owner/routes.js");
const { errorHandler } = await import("../src/middlewares/error.js");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = {
      userId: "user-1",
      name: "Owner User",
      systemRole: "SALON_USER",
      salonId: "salon-1",
      permissions: { support: ["view", "create"] },
      featureFlags: {}
    };
    next();
  });
  app.use("/owner", ownerRouter);
  app.use(errorHandler);
  return app;
};

describe("owner support tickets", () => {
  beforeEach(() => {
    prismaMock.globalSetting.findFirst.mockResolvedValue(null);
    prismaMock.supportTicket.findMany.mockReset();
    prismaMock.supportTicket.create.mockReset();
    prismaMock.supportTicket.findFirst.mockReset();
    prismaMock.supportTicket.findUnique.mockReset();
    prismaMock.supportTicket.update.mockReset();
    prismaMock.supportTicketMessage.create.mockReset();
    prismaMock.supportTicketEvent.create.mockReset();
    prismaMock.$transaction.mockReset();
  });

  it("creates a ticket with an initial thread message", async () => {
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        supportTicket: {
          create: vi.fn().mockResolvedValue({ id: "ticket-1" }),
          findUnique: vi.fn().mockResolvedValue({
            id: "ticket-1",
            title: "Printer issue",
            messages: [{ id: "msg-1", message: "Receipt printer not connecting" }]
          })
        },
        supportTicketMessage: {
          create: vi.fn().mockResolvedValue({ id: "msg-1" })
        },
        supportTicketEvent: {
          create: vi.fn().mockResolvedValue({ id: "event-1" })
        }
      })
    );

    const response = await request(buildApp()).post("/owner/support-tickets").send({
      title: "Printer issue",
      category: "POS",
      priority: "HIGH",
      description: "Receipt printer not connecting"
    });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe("ticket-1");
    expect(response.body.messages).toHaveLength(1);
  });

  it("blocks replies on closed tickets", async () => {
    prismaMock.supportTicket.findFirst.mockResolvedValue({
      id: "ticket-closed",
      salonId: "salon-1",
      status: "CLOSED"
    });

    const response = await request(buildApp()).post("/owner/support-tickets/ticket-closed/messages").send({
      message: "Please reopen this issue"
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Closed tickets cannot receive replies/i);
  });

  it("passes owner support search, status, and priority filters to the database query", async () => {
    prismaMock.supportTicket.findMany.mockResolvedValue([]);

    const response = await request(buildApp()).get("/owner/support-tickets?q=billing&status=OPEN&priority=HIGH");

    expect(response.status).toBe(200);
    expect(prismaMock.supportTicket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        salonId: "salon-1",
        status: "OPEN",
        priority: "HIGH",
        OR: expect.arrayContaining([
          expect.objectContaining({ title: { contains: "billing", mode: "insensitive" } }),
          expect.objectContaining({ description: { contains: "billing", mode: "insensitive" } })
        ])
      })
    }));
  });
});
