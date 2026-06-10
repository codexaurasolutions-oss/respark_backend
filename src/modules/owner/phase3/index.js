import { registerCampaignRoutes } from "./campaigns.js";
import { registerCatalogRoutes } from "./catalog.js";
import { registerEcommerceRoutes } from "./ecommerce.js";
import { registerMessageTemplateRoutes } from "./message-templates.js";

export const registerPhase3OwnerRoutes = (ownerRouter) => {
  registerCatalogRoutes(ownerRouter);
  registerEcommerceRoutes(ownerRouter);
  registerCampaignRoutes(ownerRouter);
  registerMessageTemplateRoutes(ownerRouter);
};
