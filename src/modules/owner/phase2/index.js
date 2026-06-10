import { registerAppointmentRoutes } from "./appointments.js";
import { registerBillingRoutes } from "./billing.js";
import { registerInventoryRoutes } from "./inventory.js";
import { registerMembershipRoutes } from "./memberships.js";
import { registerMyPageRoutes } from "./my-pages.js";
import { registerOwnerReportRoutes } from "./owner-reports.js";

export const registerPhase2OwnerRoutes = (ownerRouter) => {
  registerAppointmentRoutes(ownerRouter);
  registerBillingRoutes(ownerRouter);
  registerInventoryRoutes(ownerRouter);
  registerMembershipRoutes(ownerRouter);
  registerMyPageRoutes(ownerRouter);
  registerOwnerReportRoutes(ownerRouter);
};
