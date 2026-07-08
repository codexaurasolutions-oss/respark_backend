import { prisma } from "../../../lib/prisma.js";
import { requireSalonPermission } from "../../../middlewares/rbac.js";
import { schemas, validate } from "../../../middlewares/validate.js";

const DEFAULT_SERVICE_CONVERSION_RATIO = 1;
const DEFAULT_CASH_CONVERSION_RATIO = 0.50;

const toNumber = (v) => Number(v || 0);
const readAffiliateRatios = async (tx, salonId) => {
  const setting = await tx.salonSetting.findFirst({ where: { salonId, branchId: null } });
  const referralSettings = setting?.advancedSettings?.referralSettings || {};
  return {
    service: Math.max(0.01, toNumber(referralSettings.affiliateServiceCreditValue) || DEFAULT_SERVICE_CONVERSION_RATIO),
    cash: Math.max(0.01, toNumber(referralSettings.affiliateCashCreditValue) || DEFAULT_CASH_CONVERSION_RATIO)
  };
};

const buildAffiliateCode = async (tx, salonId) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  let exists = true;
  while (exists) {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existing = await tx.coupon.findUnique({
      where: { salonId_code: { salonId, code } }
    }).catch(() => null);
    if (!existing) exists = false;
  }
  return code;
};

const normalizePhone = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0091")) digits = digits.slice(4);
  else if (digits.startsWith("91") && digits.length > 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (digits.length !== 10) return "";
  return `+91${digits}`;
};

const ensureAffiliateArtifacts = async (tx, { salonId, partnerId, code }) => {
  if (!partnerId || !code) return;
  await tx.affiliateCreditWallet.upsert({
    where: { salonId_partnerId: { salonId, partnerId } },
    create: { salonId, partnerId, balance: 0, totalEarned: 0, totalRedeemed: 0 },
    update: {}
  });
  await tx.referralCode.upsert({
    where: { salonId_code: { salonId, code } },
    create: { salonId, customerId: partnerId, code, status: "ACTIVE" },
    update: { customerId: partnerId, status: "ACTIVE" }
  });
};

export const registerReferralRoutes = (ownerRouter) => {
  const prefix = "/referrals";

  // ──────────────────────────────────────────────────────────────
  // 0. GET NEXT AUTO-GENERATED AFFILIATE CODE
  // ──────────────────────────────────────────────────────────────
  ownerRouter.get(
    `${prefix}/coupons/next-code`,
    requireSalonPermission("couponsGiftCards", "view"),
    async (req, res, next) => {
      try {
        const salonId = req.salonId;
        const code = await buildAffiliateCode(prisma, salonId);
        res.json({ code });
      } catch (err) { next(err); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // 1. CREATE REFERRAL COUPON (with category/service eligibility)
  // ──────────────────────────────────────────────────────────────
  ownerRouter.post(
    `${prefix}/coupons`,
    requireSalonPermission("couponsGiftCards", "edit"),
    validate(schemas.createReferralCoupon),
    async (req, res, next) => {
      try {
        const salonId = req.salonId;
        const b = req.body;

        if (b.partnerCreditType && !b.partnerCreditValue && b.partnerCreditValue !== 0) {
          return res.status(400).json({ message: "Partner credit value is required when credit type is set" });
        }
        if (b.partnerCreditValue != null && b.partnerCreditValue > 0 && !b.partnerCreditType) {
          return res.status(400).json({ message: "Partner credit type is required when credit value is set" });
        }

        const coupon = await prisma.$transaction(async (tx) => {
          const code = b.code?.trim() ? b.code.trim().toUpperCase() : await buildAffiliateCode(tx, salonId);
          const created = await tx.coupon.create({
            data: {
              salonId,
              branchId: b.branchId || null,
              code,
              title: b.title.trim(),
              description: b.description || null,
              discountType: b.discountType,
              discountValue: toNumber(b.discountValue),
              minBillAmount: b.minBillAmount != null ? toNumber(b.minBillAmount) : null,
              usageLimit: b.usageLimit ?? null,
              customerUsageLimit: b.customerUsageLimit ?? null,
              startsAt: b.startsAt ? new Date(b.startsAt) : null,
              endsAt: b.endsAt ? new Date(b.endsAt) : null,
              isReferral: true,
              partnerCreditType: b.partnerCreditType || null,
              partnerCreditValue: b.partnerCreditValue != null ? toNumber(b.partnerCreditValue) : null,
              partnerCustomerId: b.partnerCustomerId || null,
              notes: b.notes || null,
            },
          });

          if (b.categoryIds && b.categoryIds.length > 0) {
            await tx.referralCouponCategory.createMany({
              data: b.categoryIds.map((categoryId) => ({ couponId: created.id, categoryId })),
            });
          }

          if (b.serviceIds && b.serviceIds.length > 0) {
            await tx.referralCouponService.createMany({
              data: b.serviceIds.map((serviceId) => ({ couponId: created.id, serviceId })),
            });
          }

          await ensureAffiliateArtifacts(tx, { salonId, partnerId: b.partnerCustomerId || null, code });

          return created;
        });

        const full = await prisma.coupon.findUnique({
          where: { id: coupon.id },
          include: {
            eligibleCategories: { include: { category: true } },
            eligibleServices: { include: { service: true } },
          },
        });

        res.status(201).json(full);
      } catch (err) { next(err); }
    }
  );

  ownerRouter.post(
    `${prefix}/partners/onboard`,
    requireSalonPermission("couponsGiftCards", "edit"),
    validate(schemas.onboardReferralPartner),
    async (req, res, next) => {
      try {
        const salonId = req.salonId;
        const b = req.body;

        const result = await prisma.$transaction(async (tx) => {
          let partnerId = b.partnerCustomerId || null;
          let partner = null;

          if (partnerId) {
            partner = await tx.customer.findFirst({ where: { id: partnerId, salonId } });
            if (!partner) throw Object.assign(new Error("Partner customer not found"), { status: 404 });
          } else {
            const phone = normalizePhone(b.phone);
            if (!phone) throw Object.assign(new Error("Valid phone number is required"), { status: 400 });
            partner = await tx.customer.findFirst({ where: { salonId, phone } });
            if (!partner) {
              partner = await tx.customer.create({
                data: {
                  salonId,
                  branchId: b.branchId || null,
                  name: b.name.trim(),
                  phone,
                  email: b.email || null,
                  source: "AFFILIATE_PARTNER",
                  tags: ["AFFILIATE_PARTNER"]
                }
              });
            }
            partnerId = partner.id;
          }

          const code = await buildAffiliateCode(tx, salonId);
          const coupon = await tx.coupon.create({
            data: {
              salonId,
              branchId: b.branchId || null,
              code,
              title: b.title?.trim() || `${partner.name} Affiliate Code`,
              description: b.description || null,
              discountType: b.discountType,
              discountValue: toNumber(b.discountValue),
              minBillAmount: b.minBillAmount != null ? toNumber(b.minBillAmount) : null,
              usageLimit: b.usageLimit ?? null,
              customerUsageLimit: b.customerUsageLimit ?? null,
              startsAt: b.startsAt ? new Date(b.startsAt) : null,
              endsAt: b.endsAt ? new Date(b.endsAt) : null,
              isReferral: true,
              partnerCreditType: b.partnerCreditType,
              partnerCreditValue: toNumber(b.partnerCreditValue),
              partnerCustomerId: partnerId,
              notes: b.notes || "Affiliate partner auto-onboarded"
            }
          });

          if (b.categoryIds?.length) {
            await tx.referralCouponCategory.createMany({
              data: b.categoryIds.map((categoryId) => ({ couponId: coupon.id, categoryId }))
            });
          }
          if (b.serviceIds?.length) {
            await tx.referralCouponService.createMany({
              data: b.serviceIds.map((serviceId) => ({ couponId: coupon.id, serviceId }))
            });
          }

          await ensureAffiliateArtifacts(tx, { salonId, partnerId, code });

          return { partner, coupon };
        });

        res.status(201).json(result);
      } catch (err) { next(err); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // 2. UPDATE REFERRAL COUPON
  // ──────────────────────────────────────────────────────────────
  ownerRouter.patch(
    `${prefix}/coupons/:couponId`,
    requireSalonPermission("couponsGiftCards", "edit"),
    validate(schemas.updateReferralCoupon),
    async (req, res, next) => {
      try {
        const salonId = req.salonId;
        const { couponId } = req.params;
        const b = req.body;

        const existing = await prisma.coupon.findFirst({
          where: { id: couponId, salonId, isReferral: true },
        });
        if (!existing) {
          return res.status(404).json({ message: "Referral coupon not found" });
        }

        if (b.code != null) {
          return res.status(400).json({ message: "Coupon code cannot be changed after creation" });
        }

        await prisma.$transaction(async (tx) => {
          const updateData = {};
          if (b.title != null) updateData.title = b.title.trim();
          if (b.description !== undefined) updateData.description = b.description || null;
          if (b.discountType != null) updateData.discountType = b.discountType;
          if (b.discountValue != null) updateData.discountValue = toNumber(b.discountValue);
          if (b.minBillAmount !== undefined) updateData.minBillAmount = b.minBillAmount != null ? toNumber(b.minBillAmount) : null;
          if (b.usageLimit !== undefined) updateData.usageLimit = b.usageLimit ?? null;
          if (b.customerUsageLimit !== undefined) updateData.customerUsageLimit = b.customerUsageLimit ?? null;
          if (b.startsAt !== undefined) updateData.startsAt = b.startsAt ? new Date(b.startsAt) : null;
          if (b.endsAt !== undefined) updateData.endsAt = b.endsAt ? new Date(b.endsAt) : null;
          if (b.partnerCreditType != null) updateData.partnerCreditType = b.partnerCreditType;
          if (b.partnerCreditValue !== undefined) updateData.partnerCreditValue = b.partnerCreditValue != null ? toNumber(b.partnerCreditValue) : null;
          if (b.partnerCustomerId !== undefined) updateData.partnerCustomerId = b.partnerCustomerId || null;
          if (b.isArchived != null) updateData.isArchived = b.isArchived;
          if (b.notes !== undefined) updateData.notes = b.notes || null;

          if (Object.keys(updateData).length > 0) {
            await tx.coupon.update({ where: { id: couponId }, data: updateData });
          }

          if (b.categoryIds != null) {
            await tx.referralCouponCategory.deleteMany({ where: { couponId } });
            if (b.categoryIds.length > 0) {
              await tx.referralCouponCategory.createMany({
                data: b.categoryIds.map((categoryId) => ({ couponId, categoryId })),
              });
            }
          }

          if (b.serviceIds != null) {
            await tx.referralCouponService.deleteMany({ where: { couponId } });
            if (b.serviceIds.length > 0) {
              await tx.referralCouponService.createMany({
                data: b.serviceIds.map((serviceId) => ({ couponId, serviceId })),
              });
            }
          }

          const refreshed = await tx.coupon.findUnique({ where: { id: couponId } });
          await ensureAffiliateArtifacts(tx, {
            salonId,
            partnerId: refreshed?.partnerCustomerId || null,
            code: refreshed?.code || null
          });
        });

        const full = await prisma.coupon.findUnique({
          where: { id: couponId },
          include: {
            eligibleCategories: { include: { category: true } },
            eligibleServices: { include: { service: true } },
          },
        });

        res.json(full);
      } catch (err) { next(err); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // 3. DELETE REFERRAL COUPON
  // ──────────────────────────────────────────────────────────────
  ownerRouter.delete(
    `${prefix}/coupons/:couponId`,
    requireSalonPermission("couponsGiftCards", "edit"),
    async (req, res, next) => {
      try {
        const salonId = req.salonId;
        const { couponId } = req.params;

        const coupon = await prisma.coupon.findFirst({
          where: { id: couponId, salonId, isReferral: true },
        });
        if (!coupon) {
          return res.status(404).json({ message: "Referral coupon not found" });
        }

        await prisma.$transaction(async (tx) => {
          await tx.referralCouponCategory.deleteMany({ where: { couponId } });
          await tx.referralCouponService.deleteMany({ where: { couponId } });
          await tx.couponRedemption.deleteMany({ where: { couponId } });
          if (coupon.code) {
            await tx.referralCode.deleteMany({ where: { salonId, code: coupon.code } });
          }
          await tx.coupon.delete({ where: { id: couponId } });
        });

        res.json({ message: "Referral coupon deleted" });
      } catch (err) { next(err); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // 4. LIST REFERRAL COUPONS
  // ──────────────────────────────────────────────────────────────
  ownerRouter.get(
    `${prefix}/coupons`,
    requireSalonPermission("couponsGiftCards", "view"),
    async (req, res, next) => {
      try {
        const salonId = req.salonId;
        const { search, includeArchived, branchId } = req.query;

        const where = { salonId, isReferral: true };
        if (branchId) where.OR = [{ branchId: String(branchId) }, { branchId: null }];
        if (includeArchived !== "true") where.isArchived = false;
        if (search) {
          const searchOr = [
            { code: { contains: search, mode: "insensitive" } },
            { title: { contains: search, mode: "insensitive" } },
          ];
          where.AND = [...(where.AND || []), { OR: searchOr }];
        }

        const coupons = await prisma.coupon.findMany({
          where,
          include: {
            eligibleCategories: { include: { category: true } },
            eligibleServices: { include: { service: true } },
            _count: { select: { redemptions: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        res.json(coupons);
      } catch (err) { next(err); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // 5. VALIDATE REFERRAL COUPON AT POS (returns eligible items + partner credit preview)
  // ──────────────────────────────────────────────────────────────
  ownerRouter.post(
    `${prefix}/coupons/validate`,
    requireSalonPermission("pos", "create"),
    async (req, res, next) => {
      try {
        const salonId = req.salonId;
        const { code, branchId, itemDrafts, customerId } = req.body;

        if (!code || typeof code !== "string") {
          return res.status(400).json({ message: "Coupon code is required" });
        }
        if (itemDrafts && !Array.isArray(itemDrafts)) {
          return res.status(400).json({ message: "itemDrafts must be an array" });
        }

        const coupon = await prisma.coupon.findFirst({
          where: { salonId, code: code.trim().toUpperCase(), isArchived: false },
          include: {
            eligibleCategories: true,
            eligibleServices: true,
          },
        });
        if (!coupon) {
          return res.status(404).json({ message: "Coupon not found" });
        }

        const now = new Date();
        const todayStr = now.toISOString().split("T")[0];
        if (coupon.startsAt) {
          const startsDay = new Date(coupon.startsAt).toISOString().split("T")[0];
          if (startsDay > todayStr) {
            return res.status(400).json({ message: "Coupon is not active yet" });
          }
        }
        if (coupon.endsAt && new Date(coupon.endsAt) < now) {
          return res.status(400).json({ message: "Coupon has expired" });
        }
        if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
          return res.status(400).json({ message: "Coupon usage limit reached" });
        }
        if (coupon.branchId && coupon.branchId !== branchId) {
          return res.status(400).json({ message: "Coupon is not valid for this branch" });
        }
        if (customerId && coupon.customerUsageLimit != null) {
          const used = await prisma.couponRedemption.count({
            where: { couponId: coupon.id, customerId },
          });
          if (used >= coupon.customerUsageLimit) {
            return res.status(400).json({ message: "Customer usage limit reached" });
          }
        }

        const hasCategoryScope = coupon.eligibleCategories.length > 0;
        const hasServiceScope = coupon.eligibleServices.length > 0;
        const isGlobal = !hasCategoryScope && !hasServiceScope;

        const eligibleCategoryIds = coupon.eligibleCategories.map((e) => e.categoryId);
        const eligibleServiceIds = coupon.eligibleServices.map((e) => e.serviceId);

        let eligibleItems = [];
        let totalEligibleAmount = 0;
        let totalDiscount = 0;
        let totalPartnerCredits = 0;

        if (isGlobal) {
          eligibleItems = (itemDrafts || []).map((item, index) => ({
            index,
            type: item.type,
            serviceId: item.serviceId || null,
            productId: item.productId || null,
            name: item.name || "Item",
            qty: Math.max(1, Number(item.qty || 1)),
            unitPrice: toNumber(item.unitPrice),
            discount: 0,
            partnerCredits: 0,
          }));
        } else {
          const enrichedDrafts = await Promise.all((itemDrafts || []).map(async (item) => {
            if (item.type === "service" && item.serviceId && !item.categoryId) {
              const svc = await prisma.service.findUnique({ where: { id: item.serviceId }, select: { categoryId: true } });
              return { ...item, categoryId: svc?.categoryId || null };
            }
            return item;
          }));

          eligibleItems = enrichedDrafts.map((item, index) => {
            let isEligible = false;
            if (item.type === "service" && item.serviceId) {
              isEligible = eligibleServiceIds.includes(item.serviceId);
              if (!isEligible && hasCategoryScope && item.categoryId) {
                isEligible = eligibleCategoryIds.includes(item.categoryId);
              }
            }
            return {
              index,
              type: item.type,
              serviceId: item.serviceId || null,
              productId: item.productId || null,
              name: item.name || "Item",
              qty: Math.max(1, Number(item.qty || 1)),
              unitPrice: toNumber(item.unitPrice),
              isEligible,
              discount: 0,
              partnerCredits: 0,
            };
          });
        }

        for (const item of eligibleItems) {
          if (isGlobal || item.isEligible) {
            const lineTotal = item.unitPrice * item.qty;
            const lineDiscount = coupon.discountType === "PERCENT"
              ? Math.min(lineTotal, lineTotal * (toNumber(coupon.discountValue) / 100))
              : Math.min(lineTotal, toNumber(coupon.discountValue));
            item.discount = lineDiscount;
            totalEligibleAmount += lineTotal;
            totalDiscount += lineDiscount;

            if (coupon.partnerCreditType && coupon.partnerCreditValue != null) {
              const credits = coupon.partnerCreditType === "PERCENT"
                ? Math.min(lineTotal, lineTotal * (toNumber(coupon.partnerCreditValue) / 100))
                : toNumber(coupon.partnerCreditValue);
              item.partnerCredits = credits;
              totalPartnerCredits += credits;
            }
          }
        }

        if (coupon.minBillAmount != null && totalEligibleAmount < toNumber(coupon.minBillAmount)) {
          return res.status(400).json({ message: `Minimum bill amount of ₹${coupon.minBillAmount} not reached. Current eligible amount: ₹${totalEligibleAmount.toFixed(2)}` });
        }

        const ratios = await readAffiliateRatios(prisma, salonId);

        res.json({
          coupon: {
            id: coupon.id,
            code: coupon.code,
            title: coupon.title,
            discountType: coupon.discountType,
            discountValue: toNumber(coupon.discountValue),
            partnerCreditType: coupon.partnerCreditType,
            partnerCreditValue: coupon.partnerCreditValue != null ? toNumber(coupon.partnerCreditValue) : null,
          },
          isGlobal,
          eligibleItems,
          totalEligibleAmount,
          totalDiscount,
          totalPartnerCredits,
          partnerCreditNote: totalPartnerCredits > 0
            ? `${totalPartnerCredits.toFixed(2)} credits will be deposited to partner wallet. 1 credit = ₹${ratios.service} for services, ₹${ratios.cash} for cash.`
            : null,
        });
      } catch (err) { next(err); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // 6. GET AFFILIATE WALLET (with ledger)
  // ──────────────────────────────────────────────────────────────
  ownerRouter.get(
    `${prefix}/wallets/:partnerId`,
    requireSalonPermission("customers", "edit"),
    async (req, res, next) => {
      try {
        const salonId = req.salonId;
        const { partnerId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        let wallet = await prisma.affiliateCreditWallet.findUnique({
          where: { salonId_partnerId: { salonId, partnerId } },
        });

        if (!wallet) {
          const partnerExists = await prisma.customer.findFirst({ where: { id: partnerId, salonId } });
          if (!partnerExists) {
            return res.status(404).json({ message: "Partner not found" });
          }
          wallet = await prisma.affiliateCreditWallet.create({
            data: { salonId, partnerId, balance: 0, totalEarned: 0, totalRedeemed: 0 },
          });
        }

        const pageNum = Math.max(1, Number(page));
        const pageSize = Math.min(100, Math.max(1, Number(limit)));
        const skip = (pageNum - 1) * pageSize;

        const [transactions, total] = await Promise.all([
          prisma.affiliateCreditTransaction.findMany({
            where: { walletId: wallet.id },
            include: { invoice: { select: { id: true, invoiceNumber: true } } },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
          }),
          prisma.affiliateCreditTransaction.count({ where: { walletId: wallet.id } }),
        ]);

        res.json({
          wallet,
          transactions,
          pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
      } catch (err) { next(err); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // 7. GET ALL AFFILIATE WALLETS (overview)
  // ──────────────────────────────────────────────────────────────
  ownerRouter.get(
    `${prefix}/wallets`,
    requireSalonPermission("customers", "edit"),
    async (req, res, next) => {
      try {
        const salonId = req.salonId;
        const { search, branchId } = req.query;

        const where = { salonId };
        if (branchId) where.partner = { branchId: String(branchId) };
        if (search) {
          where.partner = {
            ...(where.partner || {}),
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          };
        }

        const wallets = await prisma.affiliateCreditWallet.findMany({
          where,
          include: {
            partner: {
              select: { id: true, name: true, phone: true, email: true },
            },
          },
          orderBy: { updatedAt: "desc" },
        });

        res.json(wallets);
      } catch (err) { next(err); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // 8. REDEEM CREDITS FOR SERVICES (deduct from wallet)
  // ──────────────────────────────────────────────────────────────
  ownerRouter.post(
    `${prefix}/wallets/:partnerId/redeem-service`,
    requireSalonPermission("pos", "create"),
    async (req, res, next) => {
      try {
        const salonId = req.salonId;
        const { partnerId } = req.params;
        const { amount, invoiceId, note } = req.body;

        const redeemAmount = toNumber(amount);
        if (redeemAmount <= 0) {
          return res.status(400).json({ message: "Amount must be greater than 0" });
        }

        const wallet = await prisma.affiliateCreditWallet.findUnique({
          where: { salonId_partnerId: { salonId, partnerId } },
        });
        if (!wallet) {
          return res.status(404).json({ message: "Affiliate wallet not found" });
        }

        const result = await prisma.$transaction(async (tx) => {
          const freshWallet = await tx.affiliateCreditWallet.findUnique({
            where: { id: wallet.id },
          });

          if (freshWallet.balance < redeemAmount) {
            throw Object.assign(
              new Error(`Insufficient credits. Available: ${freshWallet.balance}, requested: ${redeemAmount}`),
              { status: 400 }
            );
          }

          const newBalance = Number(freshWallet.balance) - redeemAmount;

          const updatedWallet = await tx.affiliateCreditWallet.update({
            where: { id: wallet.id },
            data: {
              balance: newBalance,
              totalRedeemed: { increment: redeemAmount },
            },
          });

          const transaction = await tx.affiliateCreditTransaction.create({
            data: {
              salonId,
              walletId: wallet.id,
              type: "REDEEM_SERVICE",
              amount: redeemAmount,
              invoiceId: invoiceId || null,
              note: note || "Service redemption",
            },
          });

          return { wallet: updatedWallet, transaction };
        });

        res.json(result);
      } catch (err) { next(err); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // 9. REQUEST CASH PAYOUT
  // ──────────────────────────────────────────────────────────────
  ownerRouter.post(
    `${prefix}/wallets/:partnerId/payout`,
    requireSalonPermission("customers", "edit"),
    async (req, res, next) => {
      try {
        const salonId = req.salonId;
        const { partnerId } = req.params;
        const { creditsRedeemed } = req.body;

        const credits = toNumber(creditsRedeemed);
        if (credits <= 0) {
          return res.status(400).json({ message: "Credits must be greater than 0" });
        }

        const wallet = await prisma.affiliateCreditWallet.findUnique({
          where: { salonId_partnerId: { salonId, partnerId } },
        });
        if (!wallet) {
          return res.status(404).json({ message: "Affiliate wallet not found" });
        }

        const result = await prisma.$transaction(async (tx) => {
          const freshWallet = await tx.affiliateCreditWallet.findUnique({
            where: { id: wallet.id },
          });

          const pendingPayouts = await tx.creditPayoutRequest.findMany({
            where: { walletId: wallet.id, status: "PENDING" }
          });
          const lockedCredits = pendingPayouts.reduce((sum, p) => sum + Number(p.creditsRedeemed), 0);
          const availableCredits = Number(freshWallet.balance) - lockedCredits;

          if (credits > availableCredits) {
            throw Object.assign(
              new Error(`Insufficient available credits. Available: ${availableCredits}, pending: ${lockedCredits}, requested: ${credits}`),
              { status: 400 }
            );
          }

          const ratios = await readAffiliateRatios(tx, salonId);
          const cashAmount = credits * ratios.cash;
          const newBalance = Number(freshWallet.balance) - credits;

          await tx.affiliateCreditWallet.update({
            where: { id: wallet.id },
            data: {
              balance: newBalance,
              totalRedeemed: { increment: credits },
            },
          });

          await tx.affiliateCreditTransaction.create({
            data: {
              salonId,
              walletId: wallet.id,
              type: "CASH_WITHDRAWAL",
              amount: credits,
              note: `Cash withdrawal request: ${credits} credits → ₹${cashAmount.toFixed(2)}`,
            },
          });

          const payoutRequest = await tx.creditPayoutRequest.create({
            data: {
              salonId,
              walletId: wallet.id,
              partnerId,
              creditsRedeemed: credits,
              cashAmount,
              conversionRatio: ratios.cash,
              status: "PENDING",
            },
          });

          return payoutRequest;
        });

        res.status(201).json(result);
      } catch (err) { next(err); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // 10. LIST PAYOUT REQUESTS
  // ──────────────────────────────────────────────────────────────
  ownerRouter.get(
    `${prefix}/payouts`,
    requireSalonPermission("customers", "edit"),
    async (req, res, next) => {
      try {
        const salonId = req.salonId;
        const { status, branchId, page = 1, limit = 50 } = req.query;

        const where = { salonId };
        if (status) where.status = status;
        if (branchId) where.partner = { branchId: String(branchId) };

        const pageNum = Math.max(1, Number(page));
        const pageSize = Math.min(100, Math.max(1, Number(limit)));
        const skip = (pageNum - 1) * pageSize;

        const [requests, total] = await Promise.all([
          prisma.creditPayoutRequest.findMany({
            where,
            include: {
              partner: {
                select: { id: true, name: true, phone: true, email: true },
              },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
          }),
          prisma.creditPayoutRequest.count({ where }),
        ]);

        res.json({
          requests,
          pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) },
        });
      } catch (err) { next(err); }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // 11. APPROVE / REJECT PAYOUT REQUEST
  // ──────────────────────────────────────────────────────────────
  ownerRouter.patch(
    `${prefix}/payouts/:payoutId`,
    requireSalonPermission("customers", "edit"),
    async (req, res, next) => {
      try {
        const salonId = req.salonId;
        const { payoutId } = req.params;
        const { status, rejectionReason } = req.body;

        if (!["APPROVED", "REJECTED", "PAID"].includes(status)) {
          return res.status(400).json({ message: "Invalid status. Must be APPROVED, REJECTED, or PAID" });
        }

        const payout = await prisma.creditPayoutRequest.findFirst({
          where: { id: payoutId, salonId },
        });
        if (!payout) {
          return res.status(404).json({ message: "Payout request not found" });
        }

        if (payout.status !== "PENDING" && status !== "PAID") {
          return res.status(400).json({ message: `Cannot change status from ${payout.status} to ${status}` });
        }
        if (payout.status === "REJECTED" && status === "PAID") {
          return res.status(400).json({ message: "Cannot pay a rejected payout" });
        }

        const result = await prisma.$transaction(async (tx) => {
          const updated = await tx.creditPayoutRequest.update({
            where: { id: payoutId },
            data: {
              status,
              approvedBy: req.user?.id || null,
              approvedAt: new Date(),
              rejectionReason: status === "REJECTED" ? (rejectionReason || null) : null,
            },
          });

          if (status === "REJECTED") {
            await tx.affiliateCreditWallet.update({
              where: { id: payout.walletId },
              data: {
                balance: { increment: Number(payout.creditsRedeemed) },
                totalRedeemed: { decrement: Number(payout.creditsRedeemed) },
              },
            });

            await tx.affiliateCreditTransaction.create({
              data: {
                salonId,
                walletId: payout.walletId,
                type: "MANUAL_ADJUSTMENT",
                amount: Number(payout.creditsRedeemed),
                note: `Payout rejected — credits restored. ${rejectionReason || ""}`,
              },
            });
          }

          return updated;
        });

        res.json(result);
      } catch (err) { next(err); }
    }
  );
};
