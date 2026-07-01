import { prisma } from "../../../lib/prisma.js";
import {
  calculateLoyaltyEarnPoints,
  createAuditLog,
  getActiveLoyaltyRule,
  getCustomerValidLoyaltyBalance,
  recordLoyaltyTransaction
} from "../../../lib/phase4.js";
import { requireFeatureEnabled, requireSalonPermission } from "../../../middlewares/rbac.js";
import { schemas, validate } from "../../../middlewares/validate.js";

const withDates = (start, end) => (
  start || end
    ? { createdAt: { ...(start ? { gte: new Date(start) } : {}), ...(end ? { lte: new Date(end) } : {}) } }
    : {}
);

export const registerLoyaltyRoutes = (ownerRouter) => {
  ownerRouter.get("/loyalty/rules", requireFeatureEnabled("loyalty"), requireSalonPermission("loyalty", "view"), async (req, res) => {
    const branchId = req.query.branchId ? String(req.query.branchId) : null;
    res.json(await prisma.loyaltyRule.findMany({ where: { salonId: req.salonId, ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}) }, orderBy: { updatedAt: "desc" } }));
  });

  ownerRouter.post("/loyalty/rules", requireFeatureEnabled("loyalty"), requireSalonPermission("loyalty", "create"), validate(schemas.loyaltyRule), async (req, res) => {
    const row = await prisma.loyaltyRule.create({
      data: {
        salonId: req.salonId,
        branchId: req.body.branchId || null,
        name: req.body.name,
        pointsPerCurrency: req.body.pointsPerCurrency,
        serviceMultiplier: req.body.serviceMultiplier ?? null,
        productMultiplier: req.body.productMultiplier ?? null,
        bonusRate: req.body.bonusRate ?? null,
        minRedeemPoints: req.body.minRedeemPoints,
        maxRedeemPercent: req.body.maxRedeemPercent ?? null,
        expiryDays: req.body.expiryDays ?? null,
        birthdayPoints: req.body.birthdayPoints ?? null,
        referralPoints: req.body.referralPoints ?? null,
        isActive: req.body.isActive ?? true,
        notes: req.body.notes || null
      }
    });
    await createAuditLog({
      salonId: req.salonId,
      actorUserId: req.user.userId,
      actorMembershipId: req.user.membershipId,
      module: "LOYALTY",
      action: "RULE_CREATED",
      entityType: "LoyaltyRule",
      entityId: row.id,
      summary: `Loyalty rule ${row.name} created`
    });
    res.status(201).json(row);
  });

  ownerRouter.patch("/loyalty/rules/:id", requireFeatureEnabled("loyalty"), requireSalonPermission("loyalty", "edit"), validate(schemas.loyaltyRule), async (req, res) => {
    const row = await prisma.loyaltyRule.findFirst({ where: { id: req.params.id, salonId: req.salonId } });
    if (!row) return res.status(404).json({ message: "Loyalty rule not found" });
    const updated = await prisma.loyaltyRule.update({
      where: { id: row.id },
      data: {
        branchId: req.body.branchId || null,
        name: req.body.name,
        pointsPerCurrency: req.body.pointsPerCurrency,
        serviceMultiplier: req.body.serviceMultiplier ?? null,
        productMultiplier: req.body.productMultiplier ?? null,
        bonusRate: req.body.bonusRate ?? null,
        minRedeemPoints: req.body.minRedeemPoints,
        maxRedeemPercent: req.body.maxRedeemPercent ?? null,
        expiryDays: req.body.expiryDays ?? null,
        birthdayPoints: req.body.birthdayPoints ?? null,
        referralPoints: req.body.referralPoints ?? null,
        isActive: req.body.isActive ?? true,
        notes: req.body.notes || null
      }
    });
    await createAuditLog({
      salonId: req.salonId,
      actorUserId: req.user.userId,
      actorMembershipId: req.user.membershipId,
      module: "LOYALTY",
      action: "RULE_UPDATED",
      entityType: "LoyaltyRule",
      entityId: updated.id,
      summary: `Loyalty rule ${updated.name} updated`
    });
    res.json(updated);
  });

  ownerRouter.get("/loyalty/transactions", requireFeatureEnabled("loyalty"), requireSalonPermission("loyalty", "view"), async (req, res) => {
    const start = req.query.start ? String(req.query.start) : null;
    const end = req.query.end ? String(req.query.end) : null;
    const branchId = req.query.branchId ? String(req.query.branchId) : null;
    res.json(await prisma.loyaltyTransaction.findMany({
      where: {
        salonId: req.salonId,
        ...(branchId ? { branchId } : {}),
        ...(req.query.customerId ? { customerId: String(req.query.customerId) } : {}),
        ...withDates(start, end)
      },
      include: { customer: true, invoice: true, order: true },
      orderBy: { createdAt: "desc" }
    }));
  });

  ownerRouter.post("/loyalty/adjust", requireFeatureEnabled("loyalty"), requireSalonPermission("loyalty", "edit"), validate(schemas.loyaltyAdjust), async (req, res) => {
    const customer = await prisma.customer.findFirst({ where: { id: req.body.customerId, salonId: req.salonId } });
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    const row = await recordLoyaltyTransaction({
      salonId: req.salonId,
      branchId: req.body.branchId || null,
      customerId: customer.id,
      createdByMembershipId: req.user.membershipId,
      type: req.body.type,
      points: req.body.points,
      note: req.body.note || "Manual loyalty adjustment"
    });
    await createAuditLog({
      salonId: req.salonId,
      actorUserId: req.user.userId,
      actorMembershipId: req.user.membershipId,
      module: "LOYALTY",
      action: "MANUAL_ADJUSTMENT",
      entityType: "LoyaltyTransaction",
      entityId: row.id,
      reference: customer.name,
      summary: `Adjusted ${req.body.points} points for ${customer.name}`
    });
    res.status(201).json(row);
  });

  ownerRouter.get("/loyalty/reports", requireFeatureEnabled("loyalty"), requireSalonPermission("loyalty", "view"), async (req, res) => {
    const start = req.query.start ? String(req.query.start) : null;
    const end = req.query.end ? String(req.query.end) : null;
    const branchId = req.query.branchId ? String(req.query.branchId) : null;
    const where = { salonId: req.salonId, ...(branchId ? { branchId } : {}), ...withDates(start, end) };
    const topCustomerWhere = branchId
      ? { salonId: req.salonId, invoices: { some: { branchId } } }
      : { salonId: req.salonId };
    const [transactions, topCustomers] = await Promise.all([
      prisma.loyaltyTransaction.findMany({ where, include: { customer: true }, orderBy: { createdAt: "desc" } }),
      prisma.customer.findMany({ where: topCustomerWhere, orderBy: { loyaltyPoints: "desc" }, take: 10 })
    ]);

    const summary = transactions.reduce((acc, row) => {
      if (row.points > 0) acc.earned += row.points;
      if (row.points < 0) acc.redeemed += Math.abs(row.points);
      return acc;
    }, { earned: 0, redeemed: 0 });

    res.json({
      summary,
      topCustomers,
      transactions
    });
  });

  ownerRouter.get("/customers/:id/loyalty", requireFeatureEnabled("loyalty"), requireSalonPermission("customers", "view"), async (req, res) => {
    const customer = await prisma.customer.findFirst({ where: { id: req.params.id, salonId: req.salonId } });
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    const branchId = req.query.branchId ? String(req.query.branchId) : null;
    const [rule, history, validBalance] = await Promise.all([
      getActiveLoyaltyRule(req.salonId),
      prisma.loyaltyTransaction.findMany({
        where: { salonId: req.salonId, customerId: customer.id, ...(branchId ? { branchId } : {}) },
        include: { invoice: true, order: true },
        orderBy: { createdAt: "desc" }
      }),
      getCustomerValidLoyaltyBalance(customer.id)
    ]);
    const projectedEarn = calculateLoyaltyEarnPoints({
      rule,
      invoiceSubtotal: 1000,
      items: [{ itemType: "SERVICE" }]
    });
    res.json({
      customer,
      rule,
      balance: validBalance,
      projectedEarnPreview: projectedEarn,
      history
    });
  });
};
