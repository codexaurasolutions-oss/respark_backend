import fs from 'fs';

let content = fs.readFileSync('src/modules/reports/routes.js', 'utf8');

const targetCustomersList = `reportsRouter.get("/customers", async (req, res) => {
  res.json(await prisma.customer.findMany({
    where: isOwnScopedStaff(req, "reports")
      ? {
          salonId: req.salonId,
          OR: [
            { appointments: { some: { items: { some: { assignedStaff: { some: { userSalonId: req.user.membershipId } } } } } } },
            { invoices: { some: { items: { some: { staffUserSalonId: req.user.membershipId } } } } }
          ]
        }
      : { salonId: req.salonId },
    include: {
      memberships: { include: { membershipPlan: true } },
      packages: { include: { package: true } },
      appointments: true,
      invoices: true
    },
    orderBy: { totalSpend: "desc" }
  }));
});`;

const replacementCustomersList = `reportsRouter.get("/customers", async (req, res) => {
  const branchId = normalizeBranchId(req.query.branchId);
  const whereFilter = isOwnScopedStaff(req, "reports")
      ? {
          salonId: req.salonId,
          OR: [
            { appointments: { some: { items: { some: { assignedStaff: { some: { userSalonId: req.user.membershipId } } } } } } },
            { invoices: { some: { items: { some: { staffUserSalonId: req.user.membershipId } } } } }
          ]
        }
      : { salonId: req.salonId };
      
  const customers = await prisma.customer.findMany({
    where: whereFilter,
    include: {
      invoices: { 
        where: buildInvoiceWhere(req, branchId),
        include: { payments: true } 
      }
    },
    orderBy: { totalSpend: "desc" }
  });

  const formatted = customers.map(c => {
    let taxes = 0;
    let giftCard = 0;
    let coupon = 0;
    let referral = 0;
    let loyalty = 0;
    let balancePending = 0;
    let advanceUtilized = 0;
    let packageRedemption = 0;
    let balanceCleared = 0;
    let membershipRedemption = 0;
    let online = 0;
    let offline = 0;
    let total = 0;

    c.invoices.forEach(inv => {
      taxes += toAmount(inv.tax);
      total += toAmount(inv.total);
      balancePending += Math.max(0, toAmount(inv.total) - toAmount(inv.paidAmount));
      
      inv.payments.forEach(p => {
         const amt = toAmount(p.amount);
         const m = (p.mode || "").toLowerCase();
         if (["cash", "offline", "cash offline"].includes(m)) offline += amt;
         else online += amt;
      });
    });

    return {
      "GUEST NAME": c.name || "-",
      "GUEST NUMBER": c.phone || "-",
      "COUNT": c.totalVisits || 0,
      "TAXES": taxes || 0,
      "GIFT CARD": giftCard || "-",
      "COUPON": coupon || "-",
      "REFERRAL": referral || "-",
      "LOYALTY": loyalty || "-",
      "BALANCE PENDING": balancePending || "-",
      "ADVANCE UTILIZED": advanceUtilized || "-",
      "PACKAGE REDEMPTION": packageRedemption || "-",
      "BALANCE CLEARED": balanceCleared || "-",
      "MEMBERSHIP REDEMPTION": membershipRedemption || "-",
      "ONLINE": online || "-",
      "OFFLINE": offline || "-",
      "TOTAL": total || 0
    };
  });
  res.json(formatted);
});`;

const targetCrlf = targetCustomersList.replace(/\n/g, '\r\n');
if (content.includes(targetCustomersList)) content = content.replace(targetCustomersList, replacementCustomersList);
else if (content.includes(targetCrlf)) content = content.replace(targetCrlf, replacementCustomersList);

fs.writeFileSync('src/modules/reports/routes.js', content);
console.log("Patched guest collection logic!");
