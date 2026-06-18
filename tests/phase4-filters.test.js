import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  customerFeedback: {
    findMany: vi.fn()
  },
  salonSetting: {
    findFirst: vi.fn()
  },
  enquiry: {
    findMany: vi.fn()
  },
  expense: {
    findMany: vi.fn()
  },
  attendanceRecord: {
    findMany: vi.fn()
  },
  leaveRequest: {
    findMany: vi.fn()
  },
  incentiveRule: {
    findMany: vi.fn()
  },
  payrollRun: {
    findMany: vi.fn()
  }
};

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../src/lib/phase4.js", () => ({
  createAuditLog: vi.fn(),
  createStaffNotification: vi.fn()
}));

const { registerFeedbackRoutes } = await import("../src/modules/owner/phase4/feedback.js");
const { registerEnquiryRoutes } = await import("../src/modules/owner/phase4/enquiries.js");
const { registerOperationsRoutes } = await import("../src/modules/owner/phase4/operations.js");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = {
      userId: "owner-1",
      name: "Owner",
      systemRole: "SALON_USER",
      salonId: "salon-1",
      membershipId: "membership-1",
      featureFlags: {
        feedback: true,
        enquiries: true,
        expenses: true,
        attendance: true,
        leaves: true,
        incentives: true,
        payroll: true
      },
      permissions: {
        feedback: ["view", "edit"],
        enquiries: ["view", "edit"],
        expenses: ["view"],
        attendance: ["view"],
        leaves: ["view"],
        incentives: ["view"],
        payroll: ["view"]
      }
    };
    req.salonId = "salon-1";
    next();
  });
  const router = express.Router();
  registerFeedbackRoutes(router);
  registerEnquiryRoutes(router);
  registerOperationsRoutes(router);
  app.use("/owner", router);
  return app;
};

describe("phase4 filtered endpoints", () => {
  beforeEach(() => {
    prismaMock.customerFeedback.findMany.mockReset();
    prismaMock.salonSetting.findFirst.mockReset();
    prismaMock.enquiry.findMany.mockReset();
    prismaMock.expense.findMany.mockReset();
    prismaMock.attendanceRecord.findMany.mockReset();
    prismaMock.leaveRequest.findMany.mockReset();
    prismaMock.incentiveRule.findMany.mockReset();
    prismaMock.payrollRun.findMany.mockReset();
    prismaMock.customerFeedback.findMany.mockResolvedValue([]);
    prismaMock.enquiry.findMany.mockResolvedValue([]);
    prismaMock.salonSetting.findFirst.mockResolvedValue(null);
    prismaMock.expense.findMany.mockResolvedValue([]);
    prismaMock.attendanceRecord.findMany.mockResolvedValue([]);
    prismaMock.leaveRequest.findMany.mockResolvedValue([]);
    prismaMock.incentiveRule.findMany.mockResolvedValue([]);
    prismaMock.payrollRun.findMany.mockResolvedValue([]);
  });

  it("passes feedback status and branch filters to the database query", async () => {
    const response = await request(buildApp()).get("/owner/feedback?status=NEW&branchId=branch-1");

    expect(response.status).toBe(200);
    expect(prismaMock.customerFeedback.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        salonId: "salon-1",
        status: "NEW",
        branchId: "branch-1"
      })
    }));
  });

  it("passes enquiry status filters to the database query", async () => {
    const response = await request(buildApp()).get("/owner/enquiries?status=CONTACTED");

    expect(response.status).toBe(200);
    expect(prismaMock.enquiry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        salonId: "salon-1",
        status: "CONTACTED"
      })
    }));
  });

  it("passes expense, attendance, leave, incentive, and payroll filters to the database query", async () => {
    const expenseResponse = await request(buildApp()).get("/owner/expenses?q=rent&status=APPROVED&branchId=branch-1");
    expect(expenseResponse.status).toBe(200);
    expect(prismaMock.expense.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        salonId: "salon-1",
        status: "APPROVED",
        branchId: "branch-1",
        OR: expect.arrayContaining([
          expect.objectContaining({ title: { contains: "rent", mode: "insensitive" } }),
          expect.objectContaining({ notes: { contains: "rent", mode: "insensitive" } })
        ])
      })
    }));

    const attendanceResponse = await request(buildApp()).get("/owner/attendance?q=ayesha&branchId=branch-1");
    expect(attendanceResponse.status).toBe(200);
    expect(prismaMock.attendanceRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        salonId: "salon-1",
        branchId: "branch-1",
        userSalon: { is: { user: { is: { name: { contains: "ayesha", mode: "insensitive" } } } } }
      })
    }));

    const leaveResponse = await request(buildApp()).get("/owner/leaves?q=amna&status=APPROVED");
    expect(leaveResponse.status).toBe(200);
    expect(prismaMock.leaveRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        salonId: "salon-1",
        status: "APPROVED",
        userSalon: { is: { user: { is: { name: { contains: "amna", mode: "insensitive" } } } } }
      })
    }));

    const incentiveResponse = await request(buildApp()).get("/owner/incentives?q=sales");
    expect(incentiveResponse.status).toBe(200);
    expect(prismaMock.incentiveRule.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        salonId: "salon-1",
        OR: expect.arrayContaining([
          expect.objectContaining({ name: { contains: "sales", mode: "insensitive" } }),
          expect.objectContaining({ targetType: { contains: "sales", mode: "insensitive" } })
        ])
      })
    }));

    const payrollResponse = await request(buildApp()).get("/owner/payroll?status=PAID&branchId=branch-1");
    expect(payrollResponse.status).toBe(200);
    expect(prismaMock.payrollRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        salonId: "salon-1",
        status: "PAID",
        branchId: "branch-1"
      })
    }));
  });
});
