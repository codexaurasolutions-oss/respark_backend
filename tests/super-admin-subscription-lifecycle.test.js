import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendTrialReminderMock = vi.fn();
const convertDemoToPaidMock = vi.fn();
const runExpiredDemoCleanupMock = vi.fn();

vi.mock("../src/lib/subscriptionLifecycle.js", () => ({
  sendTrialReminder: sendTrialReminderMock,
  convertDemoToPaid: convertDemoToPaidMock
}));
vi.mock("../src/lib/trialCleanup.js", () => ({
  runExpiredDemoCleanup: runExpiredDemoCleanupMock
}));

const { superAdminRouter } = await import("../src/modules/superAdmin/routes.js");
const { errorHandler } = await import("../src/middlewares/error.js");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { userId: "super-1", name: "Super Admin", systemRole: "SUPER_ADMIN" };
    next();
  });
  app.use("/super-admin", superAdminRouter);
  app.use(errorHandler);
  return app;
};

describe("super admin subscription lifecycle", () => {
  beforeEach(() => {
    sendTrialReminderMock.mockReset();
    convertDemoToPaidMock.mockReset();
    runExpiredDemoCleanupMock.mockReset();
  });

  it("sends a trial reminder", async () => {
    sendTrialReminderMock.mockResolvedValue({
      ownerEmail: "owner@test.com",
      delivery: { mode: "json" }
    });

    const response = await request(buildApp()).post("/super-admin/subscriptions/sub-1/send-trial-reminder").send({});

    expect(response.status).toBe(200);
    expect(sendTrialReminderMock).toHaveBeenCalledWith({
      subscriptionId: "sub-1",
      actorName: "Super Admin"
    });
  });

  it("converts a demo subscription to paid", async () => {
    convertDemoToPaidMock.mockResolvedValue({
      ownerEmail: "owner@test.com",
      subscription: { id: "sub-1", status: "ACTIVE" }
    });

    const response = await request(buildApp()).post("/super-admin/subscriptions/sub-1/convert-demo").send({
      planId: "plan-1",
      paymentStatus: "PAID",
      manualDiscount: 0,
      notes: "Converted"
    });

    expect(response.status).toBe(200);
    expect(response.body.subscription.status).toBe("ACTIVE");
    expect(convertDemoToPaidMock).toHaveBeenCalledWith(expect.objectContaining({
      subscriptionId: "sub-1",
      actorName: "Super Admin",
      planId: "plan-1"
    }));
  });

  it("runs expired demo cleanup", async () => {
    runExpiredDemoCleanupMock.mockResolvedValue({ cleaned: 2, subscriptions: [] });

    const response = await request(buildApp()).post("/super-admin/subscriptions/run-demo-cleanup").send({});

    expect(response.status).toBe(200);
    expect(response.body.cleaned).toBe(2);
  });
});
