import QRCode from "qrcode";
import { prisma } from "../../../lib/prisma.js";
import { buildCatalogLink, getPublicCatalogData } from "../../../lib/phase3.js";
import { requireFeatureEnabled, requireSalonPermission } from "../../../middlewares/rbac.js";
import { schemas, validate } from "../../../middlewares/validate.js";

const getCatalogSettingsRow = async (salonId, branchId = null) =>
  prisma.catalogSetting.findFirst({
    where: { salonId, branchId }
  });

export const registerCatalogRoutes = (ownerRouter) => {
  ownerRouter.get("/catalog/settings", requireFeatureEnabled("digitalCatalog"), requireSalonPermission("catalog", "view"), async (req, res) => {
    const branchId = req.query.branchId ? String(req.query.branchId) : null;
    const effectiveBranchId = req.user?.salonRole && req.user.salonRole !== "SALON_OWNER" && req.user.branchId
      ? req.user.branchId
      : branchId;
    const row = await getCatalogSettingsRow(req.salonId, effectiveBranchId);
    res.json(row);
  });

  ownerRouter.post("/catalog/settings", requireFeatureEnabled("digitalCatalog"), requireSalonPermission("catalog", "edit"), validate(schemas.catalogSettings), async (req, res) => {
    const branchId = req.user.salonRole !== "SALON_OWNER" && req.user.branchId ? req.user.branchId : (req.body.branchId || null);
    const existing = await getCatalogSettingsRow(req.salonId, branchId);
    const payload = {
      catalogEnabled: req.body.catalogEnabled ?? true,
      customSlug: req.body.customSlug || null,
      logoUrl: req.body.logoUrl || null,
      bannerUrl: req.body.bannerUrl || null,
      showServices: req.body.showServices ?? true,
      showPackages: req.body.showPackages ?? true,
      showMemberships: req.body.showMemberships ?? true,
      showProducts: req.body.showProducts ?? true,
      showStaffPortfolio: req.body.showStaffPortfolio ?? true,
      whatsappNumber: req.body.whatsappNumber || null,
      googleReviewLink: req.body.googleReviewLink || null,
      socialLinks: req.body.socialLinks || null,
      branchDisplaySettings: req.body.branchDisplaySettings || null,
      beforeAfterGallery: req.body.beforeAfterGallery || null,
      themeColor: req.body.themeColor || null,
      allowSuspendedCatalog: req.body.allowSuspendedCatalog ?? false
    };

    const row = existing
      ? await prisma.catalogSetting.update({ where: { id: existing.id }, data: payload })
      : await prisma.catalogSetting.create({ data: { salonId: req.salonId, branchId, ...payload } });
    res.status(201).json(row);
  });

  ownerRouter.get("/catalog/banners", requireFeatureEnabled("digitalCatalog"), requireSalonPermission("catalog", "view"), async (req, res) => {
    res.json(await prisma.catalogBanner.findMany({ where: { salonId: req.salonId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }));
  });
  ownerRouter.post("/catalog/banners", requireFeatureEnabled("digitalCatalog"), requireSalonPermission("catalog", "create"), validate(schemas.catalogBanner), async (req, res) => {
    res.status(201).json(await prisma.catalogBanner.create({ data: { salonId: req.salonId, ...req.body, subtitle: req.body.subtitle || null, imageUrl: req.body.imageUrl || null, linkUrl: req.body.linkUrl || null } }));
  });
  ownerRouter.patch("/catalog/banners/:id", requireFeatureEnabled("digitalCatalog"), requireSalonPermission("catalog", "edit"), validate(schemas.catalogBanner), async (req, res) => {
    const row = await prisma.catalogBanner.findFirst({ where: { id: req.params.id, salonId: req.salonId } });
    if (!row) return res.status(404).json({ message: "Catalog banner not found" });
    res.json(await prisma.catalogBanner.update({ where: { id: row.id }, data: { ...req.body, subtitle: req.body.subtitle || null, imageUrl: req.body.imageUrl || null, linkUrl: req.body.linkUrl || null } }));
  });
  ownerRouter.delete("/catalog/banners/:id", requireFeatureEnabled("digitalCatalog"), requireSalonPermission("catalog", "delete"), async (req, res) => {
    const row = await prisma.catalogBanner.findFirst({ where: { id: req.params.id, salonId: req.salonId } });
    if (!row) return res.status(404).json({ message: "Catalog banner not found" });
    await prisma.catalogBanner.delete({ where: { id: row.id } });
    res.json({ ok: true });
  });

  ownerRouter.get("/catalog/offers", requireFeatureEnabled("digitalCatalog"), requireSalonPermission("catalog", "view"), async (req, res) => {
    res.json(await prisma.catalogOffer.findMany({ where: { salonId: req.salonId }, orderBy: { createdAt: "desc" } }));
  });
  ownerRouter.post("/catalog/offers", requireFeatureEnabled("digitalCatalog"), requireSalonPermission("catalog", "create"), validate(schemas.catalogOffer), async (req, res) => {
    const branchId = req.user.salonRole !== "SALON_OWNER" && req.user.branchId ? req.user.branchId : (req.body.branchId || null);
    res.status(201).json(await prisma.catalogOffer.create({
      data: {
        salonId: req.salonId,
        title: req.body.title,
        description: req.body.description || null,
        imageUrl: req.body.imageUrl || null,
        ctaLabel: req.body.ctaLabel || null,
        ctaUrl: req.body.ctaUrl || null,
        branchId,
        startsAt: req.body.startsAt ? new Date(req.body.startsAt) : null,
        endsAt: req.body.endsAt ? new Date(req.body.endsAt) : null,
        isActive: req.body.isActive ?? true
      }
    }));
  });
  ownerRouter.patch("/catalog/offers/:id", requireFeatureEnabled("digitalCatalog"), requireSalonPermission("catalog", "edit"), validate(schemas.catalogOffer), async (req, res) => {
    const row = await prisma.catalogOffer.findFirst({ where: { id: req.params.id, salonId: req.salonId } });
    if (!row) return res.status(404).json({ message: "Catalog offer not found" });
    res.json(await prisma.catalogOffer.update({
      where: { id: row.id },
      data: {
        title: req.body.title,
        description: req.body.description || null,
        imageUrl: req.body.imageUrl || null,
        ctaLabel: req.body.ctaLabel || null,
        ctaUrl: req.body.ctaUrl || null,
        branchId: req.body.branchId || null,
        startsAt: req.body.startsAt ? new Date(req.body.startsAt) : null,
        endsAt: req.body.endsAt ? new Date(req.body.endsAt) : null,
        isActive: req.body.isActive ?? true
      }
    }));
  });
  ownerRouter.delete("/catalog/offers/:id", requireFeatureEnabled("digitalCatalog"), requireSalonPermission("catalog", "delete"), async (req, res) => {
    const row = await prisma.catalogOffer.findFirst({ where: { id: req.params.id, salonId: req.salonId } });
    if (!row) return res.status(404).json({ message: "Catalog offer not found" });
    await prisma.catalogOffer.delete({ where: { id: row.id } });
    res.json({ ok: true });
  });

  ownerRouter.get("/catalog/preview", requireFeatureEnabled("digitalCatalog"), requireSalonPermission("catalog", "view"), async (req, res) => {
    const salon = await prisma.salon.findUnique({ where: { id: req.salonId } });
    res.json(await getPublicCatalogData(salon.slug));
  });

  ownerRouter.get("/catalog/qr", requireFeatureEnabled("digitalCatalog"), requireSalonPermission("catalog", "view"), async (req, res) => {
    const salon = await prisma.salon.findUnique({ where: { id: req.salonId } });
    const settings = await getCatalogSettingsRow(req.salonId, null);
    const publicLink = buildCatalogLink(settings?.customSlug || salon.slug);
    const qrTargetLink = `${publicLink}${publicLink.includes("?") ? "&" : "?"}src=qr`;
    const qrDataUrl = await QRCode.toDataURL(qrTargetLink);
    res.json({ publicLink, qrTargetLink, qrDataUrl });
  });

  ownerRouter.get("/catalog/analytics", requireFeatureEnabled("digitalCatalog"), requireFeatureEnabled("catalogAnalytics"), requireSalonPermission("catalogAnalytics", "view"), async (req, res) => {
    const branchId = req.query.branchId ? String(req.query.branchId) : null;
    const start = req.query.start ? new Date(String(req.query.start)) : null;
    const end = req.query.end ? new Date(String(req.query.end)) : null;
    const where = {
      salonId: req.salonId,
      ...(branchId ? { branchId } : {}),
      ...(start || end ? { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {})
    };

    const [summary, topServices, topProducts, events] = await Promise.all([
      prisma.catalogAnalyticsEvent.groupBy({
        by: ["eventType"],
        where,
        _count: { _all: true }
      }),
      prisma.catalogAnalyticsEvent.groupBy({
        by: ["serviceId"],
        where: { ...where, serviceId: { not: null }, eventType: "SERVICE_VIEW" },
        _count: { _all: true }
      }),
      prisma.catalogAnalyticsEvent.groupBy({
        by: ["productId"],
        where: { ...where, productId: { not: null }, eventType: "PRODUCT_CLICK" },
        _count: { _all: true }
      }),
      prisma.catalogAnalyticsEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 })
    ]);

    const serviceIds = topServices.map((item) => item.serviceId).filter(Boolean);
    const productIds = topProducts.map((item) => item.productId).filter(Boolean);
    const [services, products] = await Promise.all([
      serviceIds.length ? prisma.service.findMany({ where: { id: { in: serviceIds } } }) : [],
      productIds.length ? prisma.product.findMany({ where: { id: { in: productIds } } }) : []
    ]);

    res.json({
      summary,
      topServices: topServices.map((item) => ({
        serviceId: item.serviceId,
        count: item._count._all,
        service: services.find((service) => service.id === item.serviceId) || null
      })),
      topProducts: topProducts.map((item) => ({
        productId: item.productId,
        count: item._count._all,
        product: products.find((product) => product.id === item.productId) || null
      })),
      events
    });
  });
};
