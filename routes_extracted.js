ownerRouter.get("/website/config", requireSalonPermission("settings", "view"), async (req, res) => {
  let config = await prisma.websiteConfig.findUnique({
    where: { salonId: req.salonId }
  });
  if (!config) {
    config = { heroTitle: "", heroSubtitle: "", heroImage: "", sections: "[]" };
  }
  res.json({ ...config, sections: typeof config.sections === "string" ? JSON.parse(config.sections) : (config.sections || []) });
});

ownerRouter.post("/website/config", requireSalonPermission("settings", "edit"), async (req, res) => {
  const { heroTitle, heroSubtitle, heroImage, sections } = req.body;
  const sectionsStr = Array.isArray(sections) ? JSON.stringify(sections) : "[]";
  const config = await prisma.websiteConfig.upsert({
    where: { salonId: req.salonId },
    update: { heroTitle, heroSubtitle, heroImage, sections: sectionsStr },
    create: { salonId: req.salonId, heroTitle, heroSubtitle, heroImage, sections: sectionsStr }
  });
  res.json(config);
});

ownerRouter.get("/reports/trends", requireSalonPermission("reports", "view"), async (req, res) => {
  const range = req.query.range || "7D";
  const filter = String(req.query.filter || "overall").toLowerCase();

  let days = 7;
  if (range === "1D")  days = 1;
  if (range === "14D") days = 14;
  if (range === "1M")  days = 30;
  if (range === "2M")  days = 60;
  if (range === "YTD") days = Math.ceil((new Date() - new Date(new Date().getFullYear(), 0, 1)) / 86400000) || 1;
  if (range === "1Y")  days = 365;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0,0,0,0);

  const invoices = await prisma.invoice.findMany({
    where: {
      salonId: req.salonId,
      status: "PAID",
      createdAt: { gte: startDate }
    },
    include: {
      items: true
    }
  });

  const matchesFilter = (item) => {
    const type = String(item.itemType || "SERVICE").toUpperCase();
    if (filter === "service") return type === "SERVICE";
    if (filter === "product") return type === "PRODUCT";
    if (filter === "stylist") return Boolean(item.staffName);
    return true;
  };

  const filteredInvoices = invoices
    .map((invoice) => ({
      ...invoice,
      items: (invoice.items || []).filter(matchesFilter)
    }))
    .filter((invoice) => invoice.items.length > 0);

  let serviceRev = 0, productRev = 0, packageRev = 0, membershipRev = 0;

  filteredInvoices.forEach(inv => {
    inv.items.forEach(item => {
      const type  = item.itemType || "SERVICE";  // fixed: itemType not type
      const total = Number(item.lineTotal || 0); // fixed: lineTotal not total
      if (type === "SERVICE")    serviceRev    += total;
      if (type === "PRODUCT")    productRev    += total;
      if (type === "PACKAGE")    packageRev    += total;
      if (type === "MEMBERSHIP") membershipRev += total;
    });
  });

  const totalRev = serviceRev + productRev + packageRev + membershipRev;

  const revenueSplit = [
    { name: "Total", value: totalRev, fill: "#6366f1" },
    { name: "Service", value: serviceRev, fill: "#3b82f6" },
    { name: "Product", value: productRev, fill: "#10b981" },
    { name: "Package", value: packageRev, fill: "#f59e0b" },
    { name: "Membership", value: membershipRev, fill: "#ec4899" },
    { name: "Gift Card", value: 0, fill: "#8b5cf6" }
  ];

  // daily trend line
  const dateMap = {};
  const totalDays = Math.max(days, 1);
  for (let i = 0; i < totalDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (totalDays - 1 - i));
    const dateStr = d.toISOString().slice(0, 10);
    dateMap[dateStr] = { date: dateStr, total: 0, service: 0, product: 0, package: 0, membership: 0 };
  }

  filteredInvoices.forEach(inv => {
    const dStr = inv.createdAt.toISOString().slice(0, 10);
    if (dateMap[dStr]) {
      inv.items.forEach(item => {
        const type = item.itemType || "SERVICE";
        const t    = Number(item.lineTotal || 0);
        dateMap[dStr].total += t;
        if (type === "SERVICE")    dateMap[dStr].service    += t;
        if (type === "PRODUCT")    dateMap[dStr].product    += t;
        if (type === "PACKAGE")    dateMap[dStr].package    += t;
        if (type === "MEMBERSHIP") dateMap[dStr].membership += t;
      });
    }
  });

  // top services
  const serviceMap = {};
  filteredInvoices.forEach(inv => {
    inv.items.filter(i => (i.itemType || "SERVICE") === "SERVICE").forEach(item => {
      const name = item.serviceName || "Unknown";
      serviceMap[name] = (serviceMap[name] || 0) + Number(item.lineTotal || 0);
    });
  });
  const topServices = Object.entries(serviceMap)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // top staff
  const staffMap = {};
  filteredInvoices.forEach(inv => {
    inv.items.forEach(item => {
      if (!item.staffName) return;
      staffMap[item.staffName] = (staffMap[item.staffName] || 0) + Number(item.lineTotal || 0);
    });
  });
  const topStaff = Object.entries(staffMap)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  res.json({
    filter,
    revenueSplit,
    trendLine:   Object.values(dateMap),
    topServices,
    topStaff,
    summary: {
      totalInvoices: filteredInvoices.length,
      totalRevenue:  totalRev,
      avgBillValue:  filteredInvoices.length ? Math.round(totalRev / filteredInvoices.length) : 0,
    }
  });
});


ownerRouter.get("/memberships/plans", requireSalonPermission("memberships", "view"), async (req, res) => {
  try {
    const plans = await prisma.membershipPlan.findMany({ where: { salonId: req.salonId, isActive: true }, orderBy: { createdAt: "desc" } });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: "Failed to load membership plans" });
  }
});

ownerRouter.get("/customers/:id/gift-cards", requireSalonPermission("customers", "view"), async (req, res) => {
  try {
    const giftCards = await prisma.giftCard.findMany({
      where: { salonId: req.salonId, issuedToCustomerId: req.params.id },
      orderBy: { createdAt: "desc" }
    });
    res.json(giftCards.map(gc => ({
      id: gc.id,
      code: gc.code,
      title: gc.title,
      originalAmount: Number(gc.originalAmount),
      balance: Number(gc.balanceAmount),
      expiresAt: gc.expiresAt,
      status: gc.isActive ? "ACTIVE" : "INACTIVE",
      createdAt: gc.createdAt
    })));
  } catch (error) {
    res.status(500).json({ error: "Failed to load gift cards" });
  }
});

ownerRouter.get("/customers/:id/advance-payments", requireSalonPermission("customers", "view"), async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { salonId: req.salonId, customerId: req.params.id, advancePaidAmount: { gt: 0 } },
      select: { id: true, advancePaidAmount: true, createdAt: true, status: true, note: true },
      orderBy: { createdAt: "desc" }
    });
    res.json(appointments.map(a => ({
      id: a.id,
      amount: Number(a.advancePaidAmount),
      mode: "Online",
      remark: a.note || "",
      createdAt: a.createdAt,
      type: a.status === "CANCELLED" ? "refunded" : "advance"
    })));
  } catch (error) {
    res.status(500).json({ error: "Failed to load advance payments" });
  }
});

ownerRouter.post("/advance-payments", requireSalonPermission("customers", "create"), async (req, res) => {
  try {
    const { customerId, amount, mode, remark } = req.body;
    if (!customerId || !amount) return res.status(400).json({ error: "customerId and amount are required" });
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return res.status(400).json({ error: "Invalid amount" });
    const customer = await prisma.customer.findFirst({ where: { id: customerId, salonId: req.salonId } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    const appointment = await prisma.appointment.create({
      data: {
        salonId: req.salonId,
        customerId,
        branchId: null,
        startAt: new Date(),
        endAt: new Date(),
        status: "CONFIRMED",
        advancePaidAmount: numericAmount,
        advancePaymentRequired: true,
        note: remark || `Advance payment: ${numericAmount} (${mode || "Online"})`
      }
    });
    res.json({ id: appointment.id, amount: numericAmount, mode: mode || "Online", remark: remark || "", createdAt: appointment.createdAt });
  } catch (error) {
    res.status(500).json({ error: "Failed to create advance payment" });
  }
});

ownerRouter.post("/follow-ups", requireSalonPermission("customers", "edit"), async (req, res) => {
  try {
    const { customerId, date, time, message, type } = req.body;
    if (!customerId || !date || !message) return res.status(400).json({ error: "customerId, date, and message are required" });
    const customer = await prisma.customer.findFirst({ where: { id: customerId, salonId: req.salonId } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    const followUpDate = time ? new Date(`${date}T${time}`) : new Date(date);
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        followUpAt: followUpDate,
        notes: `${customer.notes || ""}\n[Follow-up ${type || "call"} ${date}${time ? ` ${time}` : ""}] ${message}`.trim()
      }
    });
    res.json({ id: customerId, date: followUpDate, message, type: type || "call", status: "scheduled" });
  } catch (error) {
    res.status(500).json({ error: "Failed to create follow-up" });
  }
});


