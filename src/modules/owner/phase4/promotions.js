import { prisma } from "../../../lib/prisma.js";
import { createAuditLog, redeemGiftCardAmount, validateCouponForContext } from "../../../lib/phase4.js";
import { requireFeatureEnabled, requireSalonPermission } from "../../../middlewares/rbac.js";
import { schemas, validate } from "../../../middlewares/validate.js";

const toDate = (value) => (value ? new Date(value) : null);

export const registerPromotionRoutes = (ownerRouter) => {
  ownerRouter.get("/coupons", requireFeatureEnabled("couponsGiftCards"), requireSalonPermission("couponsGiftCards", "view"), async (req, res) => {
    res.json(await prisma.coupon.findMany({ where: { salonId: req.salonId }, include: { branch: true, service: true, product: true }, orderBy: { createdAt: "desc" } }));
  });

  ownerRouter.post("/coupons", requireFeatureEnabled("couponsGiftCards"), requireSalonPermission("couponsGiftCards", "create"), validate(schemas.coupon), async (req, res) => {
    const row = await prisma.coupon.create({
      data: {
        salonId: req.salonId,
        branchId: req.body.branchId || null,
        serviceId: req.body.serviceId || null,
        productId: req.body.productId || null,
        code: req.body.code,
        title: req.body.title,
        description: req.body.description || null,
        discountType: req.body.discountType,
        discountValue: req.body.discountValue,
        minBillAmount: req.body.minBillAmount ?? null,
        usageLimit: req.body.usageLimit ?? null,
        customerUsageLimit: req.body.customerUsageLimit ?? null,
        startsAt: toDate(req.body.startsAt),
        endsAt: toDate(req.body.endsAt),
        isReferral: req.body.isReferral ?? false,
        isInfluencer: req.body.isInfluencer ?? false,
        isBirthday: req.body.isBirthday ?? false,
        isFestival: req.body.isFestival ?? false,
        isArchived: req.body.isArchived ?? false,
        notes: req.body.notes || null
      }
    });
    await createAuditLog({
      salonId: req.salonId,
      actorUserId: req.user.userId,
      actorMembershipId: req.user.membershipId,
      module: "COUPONS",
      action: "COUPON_CREATED",
      entityType: "Coupon",
      entityId: row.id,
      reference: row.code,
      summary: `Coupon ${row.code} created`
    });
    res.status(201).json(row);
  });

  ownerRouter.patch("/coupons/:id", requireFeatureEnabled("couponsGiftCards"), requireSalonPermission("couponsGiftCards", "edit"), validate(schemas.coupon), async (req, res) => {
    const row = await prisma.coupon.findFirst({ where: { id: req.params.id, salonId: req.salonId } });
    if (!row) return res.status(404).json({ message: "Coupon not found" });
    const updated = await prisma.coupon.update({
      where: { id: row.id },
      data: {
        branchId: req.body.branchId || null,
        serviceId: req.body.serviceId || null,
        productId: req.body.productId || null,
        code: req.body.code,
        title: req.body.title,
        description: req.body.description || null,
        discountType: req.body.discountType,
        discountValue: req.body.discountValue,
        minBillAmount: req.body.minBillAmount ?? null,
        usageLimit: req.body.usageLimit ?? null,
        customerUsageLimit: req.body.customerUsageLimit ?? null,
        startsAt: toDate(req.body.startsAt),
        endsAt: toDate(req.body.endsAt),
        isReferral: req.body.isReferral ?? false,
        isInfluencer: req.body.isInfluencer ?? false,
        isBirthday: req.body.isBirthday ?? false,
        isFestival: req.body.isFestival ?? false,
        isArchived: req.body.isArchived ?? false,
        notes: req.body.notes || null
      }
    });
    await createAuditLog({
      salonId: req.salonId,
      actorUserId: req.user.userId,
      actorMembershipId: req.user.membershipId,
      module: "COUPONS",
      action: "COUPON_UPDATED",
      entityType: "Coupon",
      entityId: updated.id,
      reference: updated.code,
      summary: `Coupon ${updated.code} updated`
    });
    res.json(updated);
  });

  ownerRouter.post("/coupons/validate", requireFeatureEnabled("couponsGiftCards"), requireSalonPermission("couponsGiftCards", "view"), validate(schemas.couponValidate), async (req, res) => {
    const result = await validateCouponForContext({
      salonId: req.salonId,
      code: req.body.code,
      customerId: req.body.customerId || null,
      branchId: req.body.branchId || null,
      serviceIds: req.body.serviceIds || [],
      productIds: req.body.productIds || [],
      subtotal: req.body.subtotal
    });
    res.json({ valid: true, ...result });
  });

  ownerRouter.get("/coupons/reports", requireFeatureEnabled("couponsGiftCards"), requireSalonPermission("couponsGiftCards", "view"), async (req, res) => {
    const [coupons, redemptions] = await Promise.all([
      prisma.coupon.findMany({ where: { salonId: req.salonId }, orderBy: { createdAt: "desc" } }),
      prisma.couponRedemption.findMany({
        where: { salonId: req.salonId },
        include: { coupon: true, customer: true, invoice: true, order: true },
        orderBy: { createdAt: "desc" }
      })
    ]);
    res.json({
      coupons,
      redemptions,
      totalSavings: redemptions.reduce((sum, row) => sum + Number(row.amountSaved || 0), 0)
    });
  });

  ownerRouter.get("/gift-cards", requireFeatureEnabled("couponsGiftCards"), requireSalonPermission("couponsGiftCards", "view"), async (req, res) => {
    res.json(await prisma.giftCard.findMany({ where: { salonId: req.salonId }, include: { issuedToCustomer: true, soldInvoice: true, redemptions: true }, orderBy: { createdAt: "desc" } }));
  });

  ownerRouter.post("/gift-cards", requireFeatureEnabled("couponsGiftCards"), requireSalonPermission("couponsGiftCards", "create"), validate(schemas.giftCard), async (req, res) => {
    const row = await prisma.giftCard.create({
      data: {
        salonId: req.salonId,
        issuedToCustomerId: req.body.customerId || null,
        soldInvoiceId: req.body.soldInvoiceId || null,
        linkedCampaignId: req.body.linkedCampaignId || null,
        createdByMembershipId: req.user.membershipId || null,
        code: req.body.code,
        title: req.body.title,
        originalAmount: req.body.originalAmount,
        balanceAmount: req.body.balanceAmount ?? req.body.originalAmount,
        expiresAt: toDate(req.body.expiresAt),
        isActive: req.body.isActive ?? true,
        note: req.body.note || null
      }
    });
    await createAuditLog({
      salonId: req.salonId,
      actorUserId: req.user.userId,
      actorMembershipId: req.user.membershipId,
      module: "GIFT_CARDS",
      action: "GIFT_CARD_CREATED",
      entityType: "GiftCard",
      entityId: row.id,
      reference: row.code,
      summary: `Gift card ${row.code} created`
    });
    res.status(201).json(row);
  });

  ownerRouter.get("/gift-cards/:id", requireFeatureEnabled("couponsGiftCards"), requireSalonPermission("couponsGiftCards", "view"), async (req, res) => {
    const row = await prisma.giftCard.findFirst({
      where: { id: req.params.id, salonId: req.salonId },
      include: { issuedToCustomer: true, soldInvoice: true, redemptions: { include: { customer: true, invoice: true, order: true }, orderBy: { createdAt: "desc" } } }
    });
    if (!row) return res.status(404).json({ message: "Gift card not found" });
    res.json(row);
  });

  ownerRouter.post("/gift-cards/redeem", requireFeatureEnabled("couponsGiftCards"), requireSalonPermission("couponsGiftCards", "edit"), validate(schemas.giftCardRedeem), async (req, res) => {
    const giftCardId = req.body.giftCardId || req.body.id;
    if (!giftCardId) return res.status(400).json({ message: "giftCardId: Gift card is required" });
    const result = await redeemGiftCardAmount({
      salonId: req.salonId,
      giftCardId,
      customerId: req.body.customerId || null,
      invoiceId: req.body.invoiceId || null,
      orderId: req.body.orderId || null,
      amountUsed: req.body.amountUsed
    });
    await createAuditLog({
      salonId: req.salonId,
      actorUserId: req.user.userId,
      actorMembershipId: req.user.membershipId,
      module: "GIFT_CARDS",
      action: "GIFT_CARD_REDEEMED",
      entityType: "GiftCardRedemption",
      entityId: result.redemption.id,
      summary: `Gift card redeemed for ${req.body.amountUsed}`
    });
    res.status(201).json({ ok: true, giftCard: result.updated, redemption: result.redemption });
  });

  ownerRouter.get("/gift-cards/reports", requireFeatureEnabled("couponsGiftCards"), requireSalonPermission("couponsGiftCards", "view"), async (req, res) => {
    const redemptions = await prisma.giftCardRedemption.findMany({
      where: { salonId: req.salonId },
      include: { giftCard: true, customer: true, invoice: true, order: true },
      orderBy: { createdAt: "desc" }
    });
    res.json({
      redemptions,
      totalRedeemed: redemptions.reduce((sum, row) => sum + Number(row.amountUsed || 0), 0)
    });
  });
};
