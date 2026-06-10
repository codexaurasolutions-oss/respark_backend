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
      systemName: "ReSpark ERP",
      maintenanceMode: false,
      whatsappNumber: "+923001234567",
      contactEmail: "hello@respark-erp.local",
      supportEmail: "support@respark-erp.local",
      defaultCurrency: "INR",
      currencyOptions: ["INR", "USD", "AED"],
      defaultCountry: "Pakistan",
      defaultCity: "Lahore",
      termsUrl: "",
      privacyUrl: "",
      demoBookingUrl: "",
      blogTitle: "Salon Operations Workspace",
      blogIntro: "Manage services, appointments, billing, customers, and team workflows from one focused salon portal."
    },
    
  );
}));

publicRouter.get("/salon/:slug", asyncHandler(async (req, res) => {
  const salon = await prisma.salon.findUnique({ where: { slug: req.params.slug } });
  if (!salon) return res.status(404).json({ message: "Salon not found" });
  const [services] = await Promise.all([
    prisma.service.findMany({ where: { salonId: salon.id, isActive: true } })
  ]);
  res.json({ salon, services });
}));

registerPublicPhase3Routes(publicRouter);
