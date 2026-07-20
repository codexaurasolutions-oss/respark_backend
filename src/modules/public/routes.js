import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { validate, schemas } from "../../middlewares/validate.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { registerPublicPhase3Routes } from "./phase3.js";

export const publicRouter = Router();

publicRouter.get("/settings", asyncHandler(async (req, res) => {
  const settings = await prisma.globalSetting.findFirst();
  res.json(
    settings || {
      systemName: "Skillify ERP",
      maintenanceMode: false,
      whatsappNumber: "+919876543210",
      contactEmail: "hello@skillify.local",
      supportEmail: "support@skillify.local",
      defaultCurrency: "INR",
      currencyOptions: ["INR", "USD", "AED"],
      defaultCountry: "Pakistan",
      defaultCity: "Lahore",
      termsUrl: "/terms",
      privacyUrl: "/privacy",
      demoBookingUrl: "",
      blogTitle: "Skillify Operations Workspace",
      blogIntro: "Manage services, appointments, billing, customers, and team workflows from one focused salon portal."
    },
    
  );
}));

publicRouter.get("/salon/:slug", asyncHandler(async (req, res) => {
  const salon = await prisma.salon.findUnique({ 
    where: { slug: req.params.slug },
    include: {
      catalogSettings: true,
      ecommerceSettings: true,
      settings: { where: { branchId: null }, take: 1 }
    }
  });
  if (!salon) return res.status(404).json({ message: "Salon not found" });
  const catalogSettings = salon.catalogSettings.find((item) => item.branchId === null) || salon.catalogSettings[0] || null;
  if (catalogSettings?.catalogEnabled === false) return res.status(403).json({ message: "Public catalog is disabled for this salon" });

  const ecommerceSettings = salon.ecommerceSettings[0] || null;
  const salonSettings = salon.settings[0] || null;
  const genericSettings = typeof salonSettings?.advancedSettings === "object"
    ? salonSettings.advancedSettings?.genericSettings || {}
    : {};
  const legalContent = typeof salonSettings?.advancedSettings === "object"
    ? salonSettings.advancedSettings?.legalContent || {}
    : {};
  const uiSettings = typeof salonSettings?.advancedSettings === "object"
    ? salonSettings.advancedSettings?.uiSettings || {}
    : {};
  const footerContent = typeof salonSettings?.advancedSettings === "object"
    ? salonSettings.advancedSettings?.footerContent || {}
    : {};
  const websiteConfig = typeof salon.featureFlags === "object" && salon.featureFlags?.websiteConfig && typeof salon.featureFlags.websiteConfig === "object"
    ? salon.featureFlags.websiteConfig
    : {};
  const showServices = catalogSettings?.showServices !== false;
  const showProducts = catalogSettings?.showProducts !== false && ecommerceSettings?.storeEnabled === true;

  const [services, products] = await Promise.all([
    showServices ? prisma.service.findMany({ where: { salonId: salon.id, isActive: true, isPublicVisible: true } }) : [],
    showProducts ? prisma.product.findMany({ where: { salonId: salon.id, isActive: true, isOnlineVisible: true }, include: { category: true, branch: true } }) : []
  ]);
  res.json({
    salon: { ...salon, settings: undefined, catalogSettings: undefined, ecommerceSettings: undefined },
    services,
    products,
    websiteConfig: {
      heroTitle: String(websiteConfig.heroTitle || ""),
      heroSubtitle: String(websiteConfig.heroSubtitle || ""),
      heroImage: String(websiteConfig.heroImage || "")
    },
    genericSettings,
    legalContent,
    uiSettings,
    footerContent,
    catalogSettings,
    ecommerceSettings,
    visibility: {
      services: showServices,
      products: showProducts,
      packages: catalogSettings?.showPackages !== false,
      memberships: catalogSettings?.showMemberships !== false,
      staff: catalogSettings?.showStaffPortfolio !== false
    }
  });
}));

registerPublicPhase3Routes(publicRouter);

publicRouter.get("/legal", asyncHandler(async (req, res) => {
  try {
    // Try to find the salon by slug first, then fallback to first salon
    const slug = req.query.slug ? String(req.query.slug) : null;
    let salonSettings = null;

    if (slug) {
      const salon = await prisma.salon.findUnique({ where: { slug }, include: { settings: { where: { branchId: null }, take: 1 } } });
      salonSettings = salon?.settings?.[0] || null;
    }

    if (!salonSettings) {
      const firstSetting = await prisma.salonSetting.findFirst({ where: { branchId: null }, orderBy: { createdAt: "asc" } });
      salonSettings = firstSetting;
    }

    const legalContent = typeof salonSettings?.advancedSettings === "object"
      ? salonSettings.advancedSettings?.legalContent || {}
      : {};

    const globalSettings = await prisma.globalSetting.findFirst();

    res.json({
      privacyPolicy: legalContent.privacyPolicy || "",
      termsAndConditions: legalContent.termsAndConditions || "",
      businessName: globalSettings?.systemName || "Skillify",
      supportEmail: globalSettings?.supportEmail || globalSettings?.contactEmail || ""
    });
  } catch {
    res.json({ privacyPolicy: "", termsAndConditions: "", businessName: "Skillify", supportEmail: "" });
  }
}));

publicRouter.get("/plans", asyncHandler(async (req, res) => {
  const plans = await prisma.plan.findMany({ orderBy: { monthlyPrice: "asc" } });
  res.json(plans.length ? plans : [
    { id: "starter", name: "Starter", monthlyPrice: 4999, yearlyPrice: 49990, trialDays: 7, branchLimit: 9999, userLimit: 5, customerLimit: 500, invoiceLimit: 1000, storageLimit: 5 },
    { id: "growth", name: "Growth", monthlyPrice: 9999, yearlyPrice: 99990, trialDays: 7, branchLimit: 9999, userLimit: 20, customerLimit: 3000, invoiceLimit: 10000, storageLimit: 20 }
  ]);
}));

// SECURITY: The following 3 debug endpoints have been REMOVED from production.
// They previously allowed anyone with the hardcoded key "respark123" to:
//   1. /public/debug-db       - read all users, settings, gift cards
//   2. /public/debug-code     - read source code (security disclosure)
//   3. /public/run-seed-services - WIPE all services & categories and re-seed
// These endpoints were removed for security reasons.
// If you need to seed services, use the seeder script in prisma/seed/seed.js instead.
