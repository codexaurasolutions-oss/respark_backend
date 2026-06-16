import PDFDocument from "pdfkit";
import { attemptCustomerTemplateEmail } from "../../../lib/emailNotifications.js";
import { prisma } from "../../../lib/prisma.js";
import { addInvoicePayment, createPosInvoice, generatePaymentLink, getDayClosingSummary, logPaymentLinkPlaceholder, refundInvoice } from "../../../lib/pos.js";
import { attachBranchStock, normalizeBranchId, toAmount } from "../../../lib/phase2.js";
import { requireFeatureEnabled, requireSalonPermission } from "../../../middlewares/rbac.js";
import { schemas, validate } from "../../../middlewares/validate.js";

const withBranchFilter = (salonId, branchId) => ({ salonId, ...(branchId ? { branchId } : {}) });
const paymentWhere = (salonId, branchId) => ({ salonId, ...(branchId ? { invoice: { is: { branchId } } } : {}) });
const sendRouteError = (res, error, fallbackMessage) => {
  const status = Number(error?.status || error?.response?.status || 500);
  return res.status(status).json({ message: error?.message || fallbackMessage });
};

const sendInvoiceAutomationEmails = async (salonId, invoice) => {
  const customerId = invoice?.customerId || null;
  const toEmail = invoice?.customer?.email || "";
  await attemptCustomerTemplateEmail({
    salonId,
    toEmail,
    templateType: "invoice_template",
    context: { invoiceId: invoice?.id, customerId }
  });

  const [soldMemberships, soldPackages] = await Promise.all([
    prisma.customerMembership.findMany({
      where: { soldInvoiceId: invoice?.id },
      include: { membershipPlan: true, customer: true }
    }),
    prisma.customerPackage.findMany({
      where: { soldInvoiceId: invoice?.id },
      include: { package: true, customer: true }
    })
  ]);

  for (const membership of soldMemberships) {
    await attemptCustomerTemplateEmail({
      salonId,
      toEmail: membership.customer?.email || toEmail,
      templateType: "membership_purchase_template",
      context: {
        customerId: membership.customerId,
        customerMembershipId: membership.id,
        invoiceId: invoice?.id
      }
    });
  }

  for (const customerPackage of soldPackages) {
    await attemptCustomerTemplateEmail({
      salonId,
      toEmail: customerPackage.customer?.email || toEmail,
      templateType: "package_purchase_template",
      context: {
        customerId: customerPackage.customerId,
        customerPackageId: customerPackage.id,
        invoiceId: invoice?.id
      }
    });
  }
};

export const registerBillingRoutes = (ownerRouter) => {
  ownerRouter.get("/pos/context", async (req, res, next) => {
    if (req.user?.systemRole === "SUPER_ADMIN") return next();
    const perms = req.user?.permissions || {};
    const flags = req.user?.featureFlags || {};
    const canPos = flags.pos !== false && Array.isArray(perms.pos) && perms.pos.includes("view");
    const canAppt = flags.appointments !== false && Array.isArray(perms.appointments) && perms.appointments.includes("view");
    
    if (!canPos && !canAppt) {
      return res.status(403).json({ message: "You don't have permission to view POS or Appointments context" });
    }
    next();
  }, async (req, res) => {
    const branchId = normalizeBranchId(req.query.branchId);
    const params = branchId ? { OR: [{ branchId }, { branchId: null }, { branchId: "" }] } : {};
    const [customers, branches, services, staffUsers, products, memberships, packages, coupons, giftCards, settings] = await Promise.all([
      prisma.customer.findMany({
        where: { salonId: req.salonId }, 
        orderBy: { createdAt: "desc" },
        include: {
          memberships: { 
            include: { membershipPlan: true },
            orderBy: { createdAt: "desc" }
          },
          packages: { 
            include: { package: true },
            orderBy: { createdAt: "desc" }
          },
          invoices: {
            select: { id: true, balanceAmount: true, status: true, createdAt: true, total: true },
            orderBy: { createdAt: "desc" },
            take: 20
          }
        }
      }),
      prisma.branch.findMany({ where: { salonId: req.salonId, isActive: true }, orderBy: { createdAt: "desc" } }),
      prisma.service.findMany({ where: { salonId: req.salonId, isActive: true, ...params }, include: { category: true, branch: true }, orderBy: { createdAt: "desc" } }),
      prisma.userSalon.findMany({
        where: { salonId: req.salonId, isArchived: false, ...params },
        include: { user: true, branch: true, serviceAssignments: { include: { service: { include: { category: true, branch: true } } } } }
      }),
      prisma.product.findMany({
        where: {
          salonId: req.salonId,
          isActive: true,
          ...(branchId ? { OR: [{ branchId }, { branchId: null }, { branchId: "" }, { stockMovements: { some: { branchId } } }] } : {})
        },
        include: { category: true, branch: true },
        orderBy: { createdAt: "desc" }
      }),
      prisma.membershipPlan.findMany({ where: { salonId: req.salonId, isActive: true }, include: { services: { include: { service: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.package.findMany({ where: { salonId: req.salonId, isActive: true }, include: { services: { include: { service: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.coupon.findMany({
        where: {
          salonId: req.salonId,
          isArchived: false,
          ...(branchId ? { OR: [{ branchId }, { branchId: null }, { branchId: "" }] } : {})
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.giftCard.findMany({
        where: {
          salonId: req.salonId,
          isActive: true,
          ...(req.query.customerId ? { OR: [{ issuedToCustomerId: String(req.query.customerId) }, { issuedToCustomerId: null }] } : {})
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.salonSetting.findFirst({ where: { salonId: req.salonId, branchId: branchId || null } })
    ]);

    // Enrich customers: compute lastVisitAt from invoices if not set
    const enrichedCustomers = customers.map(c => {
      let lastVisitAt = c.lastVisitAt;
      if (!lastVisitAt && c.invoices && c.invoices.length > 0) {
        const paidInvoice = c.invoices.find(inv => inv.status === "PAID" || inv.status === "PARTIAL");
        lastVisitAt = paidInvoice ? paidInvoice.createdAt : c.invoices[0].createdAt;
      }
      return { ...c, lastVisitAt };
    });

    const customerProfile = req.query.customerId
      ? enrichedCustomers.find((row) => row.id === String(req.query.customerId)) || null
      : null;
    res.json({
      customers: enrichedCustomers,
      branches,
      services,
      staffUsers,
      products: await attachBranchStock(prisma, products, branchId),
      memberships,
      packages,
      coupons,
      giftCards,
      customerProfile,
      settings
    });
  });

  ownerRouter.post("/pos/invoices", requireFeatureEnabled("pos"), requireSalonPermission("pos", "create"), validate(schemas.invoice), async (req, res) => {
    try {
      const invoice = await createPosInvoice({ salonId: req.salonId, actorUser: req.user, body: req.body });
      await sendInvoiceAutomationEmails(req.salonId, invoice);
      res.status(201).json(invoice);
    } catch (error) {
      return sendRouteError(res, error, "Could not create POS invoice");
    }
  });

  ownerRouter.post("/invoices", requireFeatureEnabled("pos"), requireSalonPermission("pos", "create"), validate(schemas.invoice), async (req, res) => {
    try {
      const invoice = await createPosInvoice({ salonId: req.salonId, actorUser: req.user, body: req.body });
      await sendInvoiceAutomationEmails(req.salonId, invoice);
      res.status(201).json(invoice);
    } catch (error) {
      return sendRouteError(res, error, "Could not create invoice");
    }
  });

  ownerRouter.get("/invoices", requireSalonPermission("invoices", "view"), async (req, res) => {
    const branchId = normalizeBranchId(req.query.branchId);
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim();
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    console.log("FETCHING INVOICES FOR SALON:", req.salonId, "BRANCH:", branchId, "DATE:", dateFilter);
    const result = await prisma.invoice.findMany({
      where: {
        ...withBranchFilter(req.salonId, branchId),
        ...(status ? { status } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
        ...(q ? {
          OR: [
            { invoiceNumber: { contains: q } },
            { customer: { is: { name: { contains: q } } } }
          ]
        } : {})
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: true,
        payments: true
      },
      orderBy: { createdAt: "desc" }
    });
    console.log("INVOICES FOUND:", result.length);
    res.json(result);
  });


  ownerRouter.get("/invoices/reports/summary", requireSalonPermission("invoices", "view"), async (req, res) => {
    const branchId = normalizeBranchId(req.query.branchId);
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    
    const rows = await prisma.invoice.findMany({
      where: {
        ...withBranchFilter(req.salonId, branchId),
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
      },
      select: { status: true }
    });

    res.json({
      totalInvoices: rows.length,
      unpaidInvoices: rows.filter((row) => row.status === "UNPAID").length,
      partialInvoices: rows.filter((row) => row.status === "PARTIAL").length,
      paidInvoices: rows.filter((row) => row.status === "PAID").length,
      cancelledInvoices: rows.filter((row) => row.status === "CANCELLED").length
    });
  });

  ownerRouter.get("/invoices/:id", requireSalonPermission("invoices", "view"), async (req, res) => {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, salonId: req.salonId },
      include: { customer: true, items: true, payments: true, branch: true, appointment: true }
    });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(invoice);
  });

  ownerRouter.patch("/invoices/:id", requireSalonPermission("invoices", "edit"), async (req, res) => {
    const existingInvoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, salonId: req.salonId },
      include: {
        items: true,
        payments: true,
        customer: true,
        branch: true,
        onlineOrders: true
      }
    });
    if (!existingInvoice) return res.status(404).json({ message: "Invoice not found" });
    if (existingInvoice.status === "CANCELLED" || existingInvoice.status === "REFUNDED") {
      return res.status(400).json({ message: "This invoice cannot be edited" });
    }

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!rawItems.length) return res.status(400).json({ message: "At least one invoice item is required" });

    try {
      const sanitizedItems = [];
      for (const rawItem of rawItems) {
        const qty = Math.max(1, Number(rawItem?.qty || 1));
        const unitPrice = Math.max(0, toAmount(rawItem?.unitPrice || 0));
        const taxPct = Math.max(0, toAmount(rawItem?.taxPct || 0));
        const lineBase = unitPrice * qty;
        const lineTax = (lineBase * taxPct) / 100;
        let staffName = rawItem?.staffName || null;
        let staffUserSalonId = rawItem?.staffUserSalonId || rawItem?.staffUserId || null;

        if (staffUserSalonId) {
          const staffMembership = await prisma.userSalon.findFirst({
            where: { id: String(staffUserSalonId), salonId: req.salonId },
            include: { user: true }
          });
          if (!staffMembership) {
            return res.status(400).json({ message: "Selected staff member is invalid" });
          }
          staffUserSalonId = staffMembership.id;
          staffName = staffMembership.user?.name || staffName;
        }

        if (String(rawItem?.itemType) === "PACKAGE" && (rawItem?.isCustom || rawItem?.packageId === "CUSTOM")) {
            const pack = await prisma.package.create({
              data: {
                salonId: req.salonId,
                name: String(rawItem?.serviceName || "Custom Package"),
                price: Math.max(0, toAmount(rawItem?.unitPrice || 0)),
                totalSessions: Array.isArray(rawItem?.customServices) ? rawItem.customServices.length : 1,
                validityDays: Number(rawItem?.validityDays || 30),
                isPublicVisible: false,
                isActive: true
              }
            });
            rawItem.packageId = pack.id;
            if (Array.isArray(rawItem?.customServices) && rawItem.customServices.length > 0) {
              await prisma.packageService.createMany({
                data: rawItem.customServices.map(sid => ({ packageId: pack.id, serviceId: typeof sid === 'object' ? sid.id || sid.serviceId : sid, sessions: typeof sid === 'object' && sid.qty ? Number(sid.qty) : 1 }))
              });
            }
          }

          if (String(rawItem?.itemType) === "MEMBERSHIP" && (rawItem?.isCustom || rawItem?.membershipPlanId === "CUSTOM")) {
            const plan = await prisma.membershipPlan.create({
              data: {
                salonId: req.salonId,
                name: String(rawItem?.serviceName || "Custom Membership"),
                price: Math.max(0, toAmount(rawItem?.unitPrice || 0)),
                validityDays: Number(rawItem?.validityDays || 30),
                benefitType: "DISCOUNT_PERCENTAGE",
                discountValue: 0,
                isPublicVisible: false,
                isActive: true
              }
            });
            rawItem.membershipPlanId = plan.id;
            if (Array.isArray(rawItem?.customServices) && rawItem.customServices.length > 0) {
              await prisma.membershipPlanService.createMany({
                data: rawItem.customServices.map(sid => ({ membershipPlanId: plan.id, serviceId: typeof sid === 'object' ? sid.id || sid.serviceId : sid }))
              });
            }
          }

          sanitizedItems.push({
            id: rawItem?.id ? String(rawItem.id) : null,
            itemType: String(rawItem?.itemType || "SERVICE"),
          serviceId: rawItem?.serviceId ? String(rawItem.serviceId) : null,
          productId: rawItem?.productId ? String(rawItem.productId) : null,
          membershipPlanId: rawItem?.membershipPlanId ? String(rawItem.membershipPlanId) : null,
          packageId: rawItem?.packageId ? String(rawItem.packageId) : null,
          serviceName: String(rawItem?.serviceName || rawItem?.productName || "Item"),
          staffUserSalonId,
          staffName,
          batchNumber: rawItem?.batchNumber || null,
          qty,
          unitPrice,
          taxPct,
          lineTotal: lineBase + lineTax,
          tipAmount: Math.max(0, toAmount(rawItem?.tipAmount || 0))
        });
      }

      const subtotal = sanitizedItems.reduce((sum, item) => sum + (toAmount(item.unitPrice) * Number(item.qty || 1)), 0);
      const tax = sanitizedItems.reduce((sum, item) => sum + (((toAmount(item.unitPrice) * Number(item.qty || 1)) * toAmount(item.taxPct)) / 100), 0);
      const discount = Math.max(0, toAmount(req.body?.discount ?? existingInvoice.discount ?? 0));
      const total = Math.max(0, subtotal + tax - discount);
      const paidAmount = Math.max(0, toAmount(existingInvoice.paidAmount || 0));
      const refundAmount = Math.max(0, toAmount(existingInvoice.refundAmount || 0));
      const additionalPayments = Array.isArray(req.body?.additionalPayments) ? req.body.additionalPayments : [];
      const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : existingInvoice.notes;

      const updatedInvoice = await prisma.$transaction(async (tx) => {
        const keepIds = sanitizedItems.map((item) => item.id).filter(Boolean);
        await tx.invoiceItem.deleteMany({
          where: {
            invoiceId: existingInvoice.id,
            ...(keepIds.length ? { id: { notIn: keepIds } } : {})
          }
        });

        for (const item of sanitizedItems) {
          const payload = {
            itemType: item.itemType,
            serviceId: item.serviceId,
            productId: item.productId,
            membershipPlanId: item.membershipPlanId,
            packageId: item.packageId,
            staffUserSalonId: item.staffUserSalonId,
            serviceName: item.serviceName,
            staffName: item.staffName,
            batchNumber: item.batchNumber || null,
            qty: item.qty,
            unitPrice: item.unitPrice,
            taxPct: item.taxPct,
            lineTotal: item.lineTotal,
            tipAmount: item.tipAmount
          };

          if (item.id) {
            await tx.invoiceItem.update({
              where: { id: item.id },
              data: payload
            });
          } else {
            await tx.invoiceItem.create({
              data: {
                invoiceId: existingInvoice.id,
                ...payload
              }
            });
          }
        }

        const nextBalance = Math.max(0, total - Math.max(0, paidAmount - refundAmount));
        const nextStatus = total <= 0
          ? "PAID"
          : paidAmount >= total
            ? "PAID"
            : paidAmount > 0
              ? "PARTIAL"
              : "UNPAID";

        await tx.invoice.update({
          where: { id: existingInvoice.id },
          data: {
            subtotal,
            tax,
            discount,
            total,
            balanceAmount: nextBalance,
            status: nextStatus,
            notes
          }
        });

        if (existingInvoice.onlineOrders?.length) {
          await tx.onlineOrder.updateMany({
            where: { invoiceId: existingInvoice.id, salonId: req.salonId },
            data: {
              subtotal,
              tax,
              discount,
              total,
              paidAmount
            }
          });
        }

        return tx.invoice.findUnique({
          where: { id: existingInvoice.id },
          include: { customer: true, items: true, payments: true, branch: true, appointment: true }
        });
      });

      let finalInvoice = updatedInvoice;
      for (const payment of additionalPayments) {
        const amount = toAmount(payment?.amount || 0);
        const mode = String(payment?.mode || "CASH");
        if (amount <= 0) continue;
        await addInvoicePayment({
          salonId: req.salonId,
          invoiceId: existingInvoice.id,
          amount,
          mode,
          note: payment?.note || "Collected from POS dashboard edit",
          actorUser: req.user
        });
      }

      if (additionalPayments.some((payment) => toAmount(payment?.amount || 0) > 0)) {
        finalInvoice = await prisma.invoice.findFirst({
          where: { id: existingInvoice.id, salonId: req.salonId },
          include: { customer: true, items: true, payments: true, branch: true, appointment: true }
        });
      }

      res.json(finalInvoice);
    } catch (error) {
      return sendRouteError(res, error, "Could not update invoice");
    }
  });

  ownerRouter.patch("/invoices/:id/cancel", requireSalonPermission("invoices", "edit"), async (req, res) => {
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, salonId: req.salonId }, include: { payments: true, customer: true, branch: true } });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (invoice.status === "CANCELLED") return res.status(400).json({ message: "Invoice already cancelled" });
    if (invoice.payments.some((payment) => payment.amount > 0)) return res.status(400).json({ message: "Paid invoice requires refund flow instead of cancel" });
    const cancelledInvoice = await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED", balanceAmount: 0 } });
    await attemptCustomerTemplateEmail({
      salonId: req.salonId,
      toEmail: invoice.customer?.email || "",
      templateType: "invoice_cancel_template",
      context: { invoiceId: invoice.id, customerId: invoice.customerId }
    });
    res.json(cancelledInvoice);
  });

  ownerRouter.post("/payments", requireSalonPermission("payments", "create"), validate(schemas.payment), async (req, res) => {
    const payment = await addInvoicePayment({
      salonId: req.salonId,
      invoiceId: req.body.invoiceId,
      amount: req.body.amount,
      mode: req.body.mode,
      note: req.body.note,
      actorUser: req.user
    });
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.body.invoiceId, salonId: req.salonId },
      include: { customer: true, branch: true }
    });
    await attemptCustomerTemplateEmail({
      salonId: req.salonId,
      toEmail: invoice?.customer?.email || "",
      templateType: "payment_receipt_template",
      context: { invoiceId: invoice?.id, customerId: invoice?.customerId }
    });
    res.status(201).json(payment);
  });

  ownerRouter.post("/payments/refund", requireSalonPermission("payments", "edit"), validate(schemas.refundPayment), async (req, res) => {
    const invoice = await refundInvoice({
      salonId: req.salonId,
      invoiceId: req.body.invoiceId,
      amount: req.body.amount,
      note: req.body.note,
      actorUser: req.user
    });
    await attemptCustomerTemplateEmail({
      salonId: req.salonId,
      toEmail: invoice?.customer?.email || "",
      templateType: "invoice_refund_template",
      context: { invoiceId: invoice?.id, customerId: invoice?.customerId }
    });
    res.json(invoice);
  });

  ownerRouter.get("/payments", requireSalonPermission("payments", "view"), async (req, res) => {
    const branchId = normalizeBranchId(req.query.branchId);
    const q = String(req.query.q || "").trim();
    const mode = String(req.query.mode || "").trim();
    const type = String(req.query.type || "").trim();
    res.json(await prisma.payment.findMany({
      where: {
        ...paymentWhere(req.salonId, branchId),
        ...(mode ? { mode } : {}),
        ...(type ? { type } : {}),
        ...(q ? {
          OR: [
            { note: { contains: q } },
            { invoice: { is: { invoiceNumber: { contains: q } } } },
            { invoice: { is: { customer: { is: { name: { contains: q } } } } } }
          ]
        } : {})
      },
      include: { invoice: { include: { customer: true, branch: true } } },
      orderBy: { createdAt: "desc" }
    }));
  });

  ownerRouter.post("/invoices/:id/payment-link", requireSalonPermission("payments", "edit"), validate(schemas.paymentLink), async (req, res) => {
    const invoice = await generatePaymentLink({
      salonId: req.salonId,
      invoiceId: req.params.id,
      expiresAt: req.body.expiresAt,
      gatewayName: req.body.gatewayName,
      note: req.body.note
    });
    const frontendBase = process.env.FRONTEND_APP_URL || "http://127.0.0.1:5173";
    res.status(201).json({
      invoiceId: invoice.id,
      paymentLinkToken: invoice.paymentLinkToken,
      paymentLinkStatus: invoice.paymentLinkStatus,
      paymentLinkUrl: `${frontendBase}/pay/${invoice.paymentLinkToken}`
    });
  });

  ownerRouter.post("/invoices/:id/payment-link/log", requireSalonPermission("payments", "edit"), validate(schemas.paymentLinkLog), async (req, res) => {
    try {
      const paymentLog = await logPaymentLinkPlaceholder({
        salonId: req.salonId,
        invoiceId: req.params.id,
        status: req.body.status,
        note: req.body.note,
        gatewayRef: req.body.gatewayRef
      });
      res.status(201).json(paymentLog);
    } catch (error) {
      return sendRouteError(res, error, "Could not update payment link placeholder");
    }
  });

  ownerRouter.post("/invoices/:id/payment-reminder", requireSalonPermission("payments", "edit"), async (req, res) => {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, salonId: req.salonId },
      include: { customer: true, branch: true }
    });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    const note = `Payment reminder placeholder sent on ${new Date().toLocaleString()} for ${invoice.invoiceNumber}`;
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        notes: [invoice.notes, note].filter(Boolean).join("\n")
      }
    });
    await attemptCustomerTemplateEmail({
      salonId: req.salonId,
      toEmail: invoice.customer?.email || "",
      templateType: "invoice_template",
      context: { invoiceId: invoice.id, customerId: invoice.customerId }
    });
    res.status(201).json({
      invoiceId: updated.id,
      invoiceNumber: updated.invoiceNumber,
      channelHints: ["WHATSAPP_PLACEHOLDER", "SMS_PLACEHOLDER", "EMAIL_PLACEHOLDER"],
      reminderPreview: `Reminder: pending balance ${updated.balanceAmount} on invoice ${updated.invoiceNumber}`
    });
  });

  ownerRouter.get("/pos/day-closing", requireFeatureEnabled("pos"), requireSalonPermission("payments", "view"), async (req, res) => {
    const branchId = normalizeBranchId(req.query.branchId);
    res.json(await getDayClosingSummary({ salonId: req.salonId, branchId, date: req.query.date ? String(req.query.date) : undefined }));
  });

  
  ownerRouter.get("/invoices/:id", requireSalonPermission("invoices", "view"), async (req, res) => {
    try {
      const inv = await prisma.invoice.findFirst({
        where: { id: req.params.id, salonId: req.salonId },
        include: { 
          customer: true, 
          items: true, 
          payments: true, 
          branch: true 
        }
      });
      if (!inv) return res.status(404).json({ message: "Invoice not found" });
      res.json(inv);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  ownerRouter.get("/invoices/:id/receipt", requireSalonPermission("invoices", "view"), async (req, res) => {
    const inv = await prisma.invoice.findFirst({
      where: { id: req.params.id, salonId: req.salonId },
      include: { customer: true, items: true, payments: true, branch: true }
    });
    if (!inv) return res.status(404).json({ message: "Invoice not found" });
    const settings = await prisma.salonSetting.findFirst({ where: { salonId: req.salonId, branchId: inv.branchId || null } });
    const footer = settings?.invoiceFooter || "Thank you for visiting.";
    const salonName = inv.branch?.name || "My Salon";
    const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const items = inv.items.map((item) => {
      const rate = Number(item.unitPrice || 0);
      const qty = Number(item.qty || 1);
      const amt = Number(item.lineTotal || rate * qty);
      const discLabel = Number(item.appliedBenefitValue) > 0
        ? `<div style="font-size:11px;color:#94a3b8;">Disc: ${Number(item.unitPrice) > 0 ? ((Number(item.appliedBenefitValue) / Number(item.unitPrice)) * 100).toFixed(2) : "0"}%</div>`
        : "";
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;">${item.serviceName || "Item"}${discLabel}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;color:#0f172a;">${qty}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;color:#0f172a;">${fmt(rate)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#0f172a;">${fmt(amt)}</td>
      </tr>`;
    }).join("");

    const appliedBenefits = [
      inv.couponCode ? `<tr><td colspan="3" style="padding:4px 10px;color:#64748b;">Coupon</td><td style="padding:4px 10px;text-align:right;color:#64748b;">${inv.couponCode}</td></tr>` : "",
      inv.giftVoucherCode ? `<tr><td colspan="3" style="padding:4px 10px;color:#64748b;">Gift Card</td><td style="padding:4px 10px;text-align:right;color:#64748b;">${inv.giftVoucherCode}</td></tr>` : "",
      inv.loyaltyPointsUsed ? `<tr><td colspan="3" style="padding:4px 10px;color:#64748b;">Loyalty Points</td><td style="padding:4px 10px;text-align:right;color:#64748b;">${inv.loyaltyPointsUsed} pts</td></tr>` : ""
    ].join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${inv.invoiceNumber}</title></head><body style="font-family:'Segoe UI',sans-serif;padding:24px;background:#f8fafc;margin:0;">
    <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
      <div style="background:#0f172a;color:#fff;padding:14px 20px;text-align:center;font-size:16px;font-weight:700;">Bill Invoice</div>
      <div style="padding:20px 24px;text-align:center;border-bottom:1px dashed #cbd5e1;">
        <div style="font-size:18px;font-weight:700;color:#0f172a;">${salonName}</div>
        ${inv.branch?.address ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">${inv.branch.address}</div>` : ""}
        ${inv.branch?.phone ? `<div style="font-size:12px;color:#64748b;">Phone: ${inv.branch.phone}</div>` : ""}
      </div>
      <div style="padding:16px 24px;background:#f8fafc;border-bottom:1px dashed #cbd5e1;">
        <div style="font-size:12px;font-weight:600;color:#64748b;margin-bottom:8px;">GUEST DETAILS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;font-size:13px;">
          <div><strong>Invoice:</strong> ${inv.invoiceNumber}</div>
          <div><strong>Date:</strong> ${new Date(inv.createdAt).toLocaleDateString('en-GB').replace(/\//g, '-')}</div>
          <div><strong>Name:</strong> ${inv.customer?.name || "Walk-in Customer"}</div>
          <div><strong>Phone:</strong> ${inv.customer?.phone || "-"}</div>
        </div>
      </div>
      <div style="padding:0;">
        <div style="background:#0f172a;color:#fff;padding:10px 20px;font-size:13px;font-weight:600;">Bill Invoice</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px;text-align:left;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0;">Item</th>
              <th style="padding:10px;text-align:center;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0;">Qty</th>
              <th style="padding:10px;text-align:right;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0;">Rate</th>
              <th style="padding:10px;text-align:right;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0;">Total</th>
            </tr>
          </thead>
          <tbody>${items}</tbody>
          <tfoot>
            ${appliedBenefits}
            <tr><td colspan="3" style="padding:10px 10px;border-top:1px solid #e2e8f0;font-weight:600;color:#64748b;">Subtotal</td><td style="padding:10px;text-align:right;border-top:1px solid #e2e8f0;font-weight:600;color:#0f172a;">Rs ${fmt(inv.subtotal)}</td></tr>
            ${Number(inv.discount) > 0 ? `<tr><td colspan="3" style="padding:4px 10px;color:#64748b;">Discount</td><td style="padding:4px 10px;text-align:right;color:#22c55e;font-weight:600;">- Rs ${fmt(inv.discount)}</td></tr>` : ""}
            ${Number(inv.tax) > 0 ? `<tr><td colspan="3" style="padding:4px 10px;color:#64748b;">Tax</td><td style="padding:4px 10px;text-align:right;color:#f59e0b;font-weight:600;">+ Rs ${fmt(inv.tax)}</td></tr>` : ""}
          </tfoot>
        </table>
      </div>
      <div style="padding:16px 24px;border-top:2px solid #0f172a;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:16px;font-weight:700;color:#0f172a;">Total</span>
          <span style="font-size:18px;font-weight:700;color:#0f172a;">Rs ${fmt(inv.total)}</span>
        </div>
        ${Number(inv.paidAmount) > 0 ? `<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px;"><span style="font-weight:600;color:#0f172a;">Paid by:</span><span style="font-weight:600;color:#166534;">Rs ${fmt(inv.paidAmount)}</span></div>` : ""}
        ${Number(inv.balanceAmount) > 0 ? `<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:13px;"><span style="font-weight:600;color:#0f172a;">Balance Due:</span><span style="font-weight:600;color:#991b1b;">Rs ${fmt(inv.balanceAmount)}</span></div>` : ""}
      </div>
      <div style="padding:16px 24px;border-top:1px dashed #cbd5e1;text-align:center;font-size:13px;color:#64748b;">${footer}</div>
    </div></body></html>`;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  });

  ownerRouter.get("/invoices/:id/pdf", requireSalonPermission("invoices", "view"), async (req, res) => {
    const inv = await prisma.invoice.findFirst({
      where: { id: req.params.id, salonId: req.salonId },
      include: { items: true, payments: true, customer: true, branch: true }
    });
    if (!inv) return res.status(404).json({ error: "Invoice not found" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="invoice-${inv.invoiceNumber}.pdf"`);

    // Create a modern Thermal POS Receipt PDF
    const width = 300;
    const margin = 20;
    const docHeight = 500 + (inv.items.length * 30);
    const pdf = new PDFDocument({ margin: margin, size: [width, docHeight] });
    pdf.pipe(res);

    const salonName = inv.branch?.name || inv.salon?.name || "My Salon";
    const brandName = salonName.split(" ")[0]?.toUpperCase() || "SALON";
    const phone = inv.branch?.phone || inv.salon?.phone || "";

    // Header
    pdf.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text('Bill Invoice', margin, margin, { align: 'center' });
    pdf.moveDown(0.3);

    pdf.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a').text(salonName, { align: 'center' });
    pdf.font('Helvetica').fontSize(8).fillColor('#64748b');
    if (inv.branch?.address || inv.salon?.address) pdf.text(inv.branch?.address || inv.salon?.address, { align: 'center' });
    if (phone) pdf.text(`Phone: ${phone}`, { align: 'center' });

    let y = pdf.y + 8;

    // Dashed line helper
    const drawDashedLine = (yPos) => {
      pdf.moveTo(margin, yPos).lineTo(width - margin, yPos).dash(3, { space: 3 }).strokeColor('#cbd5e1').stroke();
      pdf.undash();
    };

    drawDashedLine(y);
    y += 8;

    // Guest Details
    pdf.rect(margin, y, width - margin * 2, 16).fillColor('#0f172a').fill();
    pdf.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('Guest Details', margin, y + 4, { align: 'center' });
    y += 20;

    const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const guestFields = [
      ['Invoice:', inv.invoiceNumber],
      ['Date:', new Date(inv.createdAt).toLocaleDateString('en-GB').replace(/\//g, '-')],
      ['Name:', inv.customer?.name || "Walk-in Customer"],
      ['Phone:', inv.customer?.phone || "-"]
    ];
    guestFields.forEach(([label, value]) => {
      pdf.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(label, margin + 4, y, { continued: true, width: 100 });
      pdf.font('Helvetica').text(String(value || "-"), { align: 'left' });
      y += 13;
    });

    drawDashedLine(y);
    y += 8;

    // Items Table Header
    pdf.rect(margin, y, width - margin * 2, 16).fillColor('#0f172a').fill();
    pdf.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('Bill Invoice', margin, y + 4, { align: 'center' });
    y += 20;

    // Table column positions
    const colItem = margin + 2;
    const colQty = margin + 140;
    const colRate = margin + 175;
    const colTotal = margin + 225;

    // Table header row
    pdf.fillColor('#94a3b8').fontSize(8).font('Helvetica-Bold');
    pdf.text('Item', colItem, y, { width: 130 });
    pdf.text('Qty', colQty, y, { width: 30, align: 'center' });
    pdf.text('Rate', colRate, y, { width: 45, align: 'right' });
    pdf.text('Total', colTotal, y, { width: 50, align: 'right' });
    y += 14;

    // Table items
    if (inv.items.length === 0) {
      pdf.fillColor('#94a3b8').fontSize(9).font('Helvetica').text('No items', margin, y, { align: 'center' });
      y += 16;
    } else {
      inv.items.forEach(item => {
        const rate = Number(item.unitPrice || 0);
        const qty = Number(item.qty || 1);
        const amt = Number(item.lineTotal || rate * qty);
        const itemName = item.serviceName || "Item";

        // Item name
        pdf.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(itemName, colItem, y, { width: 130 });

        // Discount label
        if (Number(item.appliedBenefitValue) > 0) {
          y += 12;
          const discPct = Number(item.unitPrice) > 0 ? ((Number(item.appliedBenefitValue) / Number(item.unitPrice)) * 100).toFixed(2) : "0";
          pdf.fillColor('#94a3b8').fontSize(7).font('Helvetica').text(`Disc: ${discPct}%`, colItem, y, { width: 130 });
        }

        // Qty, Rate, Total
        const rowY = y - (Number(item.appliedBenefitValue) > 0 ? 12 : 0);
        pdf.fillColor('#0f172a').fontSize(9).font('Helvetica').text(String(qty), colQty, rowY + 2, { width: 30, align: 'center' });
        pdf.text(fmt(rate), colRate, rowY + 2, { width: 45, align: 'right' });
        pdf.font('Helvetica-Bold').text(fmt(amt), colTotal, rowY + 2, { width: 50, align: 'right' });

        y += Number(item.appliedBenefitValue) > 0 ? 24 : 16;
      });
    }

    drawDashedLine(y);
    y += 8;

    // Totals
    const summaryX = margin + 120;
    const summaryValX = margin + 225;

    pdf.fillColor('#0f172a').fontSize(9).font('Helvetica').text('Subtotal', summaryX, y, { width: 100, align: 'right' });
    pdf.font('Courier').text(fmt(inv.subtotal), summaryValX, y, { width: 55, align: 'right' });
    y += 14;

    if (Number(inv.discount) > 0) {
      pdf.fillColor('#0f172a').font('Helvetica').text('Discount', summaryX, y, { width: 100, align: 'right' });
      pdf.font('Courier').text('- ' + fmt(inv.discount), summaryValX, y, { width: 55, align: 'right' });
      y += 14;
    }
    if (Number(inv.tax) > 0) {
      pdf.fillColor('#0f172a').font('Helvetica').text('Tax', summaryX, y, { width: 100, align: 'right' });
      pdf.font('Courier').text('+ ' + fmt(inv.tax), summaryValX, y, { width: 55, align: 'right' });
      y += 14;
    }

    drawDashedLine(y);
    y += 8;

    pdf.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('Total', summaryX, y, { width: 100, align: 'right' });
    pdf.font('Courier-Bold').fontSize(12).text('Rs ' + fmt(inv.total), summaryValX, y, { width: 55, align: 'right' });
    y += 18;

    const paid = Number(inv.paidAmount || 0);
    const balance = Number(inv.balanceAmount || 0);

    if (paid > 0) {
      pdf.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Paid by:', margin, y);
      pdf.fillColor('#166534').font('Helvetica-Bold').text('Rs ' + fmt(paid), summaryValX, y, { width: 55, align: 'right' });
      y += 14;
    }
    if (balance > 0) {
      pdf.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Balance Due:', margin, y);
      pdf.fillColor('#991b1b').font('Helvetica-Bold').text('Rs ' + fmt(balance), summaryValX, y, { width: 55, align: 'right' });
      y += 14;
    }

    drawDashedLine(y);
    y += 10;

    // Footer
    pdf.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text('Thank you for choosing us.', margin, y, { align: 'center' });

    pdf.end();
  });


};



