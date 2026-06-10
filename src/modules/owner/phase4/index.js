import { registerCommunicationRoutes } from "./communications.js";
import { registerEnquiryRoutes } from "./enquiries.js";
import { registerFeedbackRoutes } from "./feedback.js";
import { registerLoyaltyRoutes } from "./loyalty.js";
import { registerOperationsRoutes } from "./operations.js";
import { registerPromotionRoutes } from "./promotions.js";
import { registerAdvancedReportRoutes } from "./reports.js";

export const registerPhase4OwnerRoutes = (ownerRouter) => {
  registerLoyaltyRoutes(ownerRouter);
  registerPromotionRoutes(ownerRouter);
  registerFeedbackRoutes(ownerRouter);
  registerEnquiryRoutes(ownerRouter);
  registerOperationsRoutes(ownerRouter);
  registerCommunicationRoutes(ownerRouter);
  registerAdvancedReportRoutes(ownerRouter);
};
