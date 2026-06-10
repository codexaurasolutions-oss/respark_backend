import { prisma } from "../../../lib/prisma.js";
import { buildCsv, normalizeBranchId } from "../../../lib/phase2.js";
import { requireFeatureEnabled, requireSalonPermission } from "../../../middlewares/rbac.js";
import { buildAppointmentScope } from "./shared.js";

export const registerOwnerReportRoutes = (ownerRouter) => {
  ownerRouter.get("/reports/appointments", requireFeatureEnabled("reports"), requireSalonPermission("reports", "view"), async (req, res) => {
    const branchId = normalizeBranchId(req.query.branchId);
    res.json(await prisma.appointment.findMany({
      where: buildAppointmentScope(req, branchId),
      include: { customer: true, branch: true, items: { include: { service: true } } },
      orderBy: { startAt: "desc" }
    }));
  });

  ownerRouter.get("/reports/stock", requireFeatureEnabled("reports"), requireSalonPermission("reports", "view"), async (req, res) => {
    const branchId = normalizeBranchId(req.query.branchId);
    res.json(await prisma.stockMovement.findMany({
      where: { salonId: req.salonId, ...(branchId ? { branchId } : {}) },
      include: { product: true },
      orderBy: { createdAt: "desc" }
    }));
  });

  ownerRouter.get("/reports/stock/export.csv", requireFeatureEnabled("reports"), requireSalonPermission("reports", "view"), async (req, res) => {
    const rows = await prisma.stockMovement.findMany({
      where: { salonId: req.salonId },
      include: { product: true },
      orderBy: { createdAt: "desc" }
    });
    const csv = buildCsv(
      ["Product", "Movement", "Quantity", "Before", "After", "Reference", "CreatedAt"],
      rows.map((row) => [row.product.name, row.movementType, row.quantity, row.stockBefore, row.stockAfter, row.referenceType || "", row.createdAt.toISOString()])
    );
    res.setHeader("Content-Type", "text/csv");
    res.send(csv);
  });
};
