import { createOnlineOrder, createPublicAppointment, ensurePublicStoreEnabled, getPublicCatalogData, resolvePublicSalonBySlug, trackCatalogEvent, validateCartAgainstStock } from "../../lib/phase3.js";
import { getNotificationToggles } from "../../lib/emailAutomation.js";
import { attemptCustomerTemplateEmail } from "../../lib/emailNotifications.js";
import { createStaffNotification } from "../../lib/phase4.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { schemas, validate } from "../../middlewares/validate.js";

export const registerPublicPhase3Routes = (publicRouter) => {
  publicRouter.get("/salons/:slug", asyncHandler(async (req, res) => {
    res.json(await getPublicCatalogData(req.params.slug));
  }));
  publicRouter.get("/salons/:slug/services", asyncHandler(async (req, res) => {
    const data = await getPublicCatalogData(req.params.slug);
    res.json({ salon: data.salon, settings: data.settings, services: data.services });
  }));
  publicRouter.get("/salons/:slug/packages", asyncHandler(async (req, res) => {
    const data = await getPublicCatalogData(req.params.slug);
    res.json({ salon: data.salon, settings: data.settings, packages: data.packages });
  }));
  publicRouter.get("/salons/:slug/memberships", asyncHandler(async (req, res) => {
    const data = await getPublicCatalogData(req.params.slug);
    res.json({ salon: data.salon, settings: data.settings, memberships: data.memberships });
  }));
  publicRouter.get("/salons/:slug/products", asyncHandler(async (req, res) => {
    const data = await getPublicCatalogData(req.params.slug);
    res.json({ salon: data.salon, settings: data.settings, products: data.products });
  }));
  publicRouter.get("/salons/:slug/offers", asyncHandler(async (req, res) => {
    const data = await getPublicCatalogData(req.params.slug);
    res.json({ salon: data.salon, settings: data.settings, offers: data.offers });
  }));
  publicRouter.post("/salons/:slug/analytics/event", validate(schemas.catalogEvent), asyncHandler(async (req, res) => {
    const event = await trackCatalogEvent({ slug: req.params.slug, body: req.body });
    res.status(201).json({ ok: true, eventId: event?.id || null });
  }));
  publicRouter.post("/salons/:slug/book", validate(schemas.publicBooking), asyncHandler(async (req, res) => {
    const appointment = await createPublicAppointment({ slug: req.params.slug, body: req.body });
    const { isOn, emailEnabled } = await getNotificationToggles(appointment.salonId, appointment.branchId || null).catch(() => ({ isOn: () => true, emailEnabled: true }));
    if (isOn("messageForAppointments") && isOn("appointmentConfirmedToCustomer") && emailEnabled) {
      await attemptCustomerTemplateEmail({
        salonId: appointment.salonId,
        toEmail: appointment.customer?.email || "",
        templateType: "appointment_confirmation",
        context: {
          appointmentId: appointment.id,
          customerId: appointment.customerId
        }
      });
    }
    if (isOn("messageForAppointments") && isOn("onlineAppointmentBookedToOwner")) {
      await createStaffNotification({
        salonId: appointment.salonId,
        userSalonId: null,
        title: "New online appointment booked",
        message: `A customer booked an appointment for ${new Date(appointment.startAt).toLocaleString()}.`,
        type: "APPOINTMENT",
        linkUrl: `/admin/appointments/${appointment.id}`
      }).catch(() => {});
    }
    res.status(201).json(appointment);
  }));
  publicRouter.post("/salons/:slug/cart/validate", validate(schemas.cartValidate), asyncHandler(async (req, res) => {
    const { salon } = await resolvePublicSalonBySlug(req.params.slug);
    await ensurePublicStoreEnabled(salon.id);
    const products = await validateCartAgainstStock(salon.id, req.body.items);
    res.json({ ok: true, products });
  }));
  publicRouter.post("/salons/:slug/orders", validate(schemas.createOrder), asyncHandler(async (req, res) => {
    const { salon } = await resolvePublicSalonBySlug(req.params.slug);
    await ensurePublicStoreEnabled(salon.id);
    const order = await createOnlineOrder({ salonId: salon.id, body: req.body, source: "PUBLIC_STORE" });
    const { isOn, emailEnabled } = await getNotificationToggles(salon.id, order.branchId || null).catch(() => ({ isOn: () => true, emailEnabled: true }));
    if (isOn("messageForOrders") && isOn("orderConfirmed") && emailEnabled) {
      await attemptCustomerTemplateEmail({
        salonId: salon.id,
        toEmail: order.customer?.email || "",
        templateType: "order_confirmation",
        context: {
          orderId: order.id,
          customerId: order.customerId
        }
      });
    }
    if ((order.couponCode || order.giftCardCode) && isOn("onlineRedeemablePurchaseToOwner")) {
      await createStaffNotification({
        salonId: salon.id,
        userSalonId: null,
        title: "Online redeemable purchase",
        message: `Order ${order.orderNumber} used ${order.couponCode ? `coupon ${order.couponCode}` : `gift card ${order.giftCardCode}`}.`,
        type: "ORDER",
        linkUrl: `/admin/orders/${order.id}`
      }).catch(() => {});
    }
    res.status(201).json(order);
  }));
};
