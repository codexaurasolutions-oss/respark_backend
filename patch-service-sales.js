import fs from 'fs';

let content = fs.readFileSync('src/modules/reports/routes.js', 'utf8');

const target = `reportsRouter.get("/service-sales", async (req, res) => {
  const branchId = normalizeBranchId(req.query.branchId);
  const rows = await prisma.invoiceItem.findMany({
    where: {
      itemType: "SERVICE",
      invoice: { is: buildInvoiceWhere(req, branchId) },
      ...(isOwnScopedStaff(req, "reports") ? { staffUserSalonId: req.user.membershipId } : {})
    }
  });
  const grouped = {};
  rows.forEach((row) => {
    const key = row.serviceId || row.serviceName;
    if (!grouped[key]) grouped[key] = { serviceId: row.serviceId, name: row.serviceName, qty: 0, sales: 0 };
    grouped[key].qty += Number(row.qty || 0);
    grouped[key].sales += toAmount(row.lineTotal);
  });
  res.json(Object.values(grouped).sort((a, b) => b.sales - a.sales));
});`;

const replacement = `reportsRouter.get("/service-sales", async (req, res) => {
  const branchId = normalizeBranchId(req.query.branchId);
  const rows = await prisma.invoiceItem.findMany({
    where: {
      itemType: "SERVICE",
      invoice: { is: buildInvoiceWhere(req, branchId) },
      ...(isOwnScopedStaff(req, "reports") ? { staffUserSalonId: req.user.membershipId } : {})
    },
    include: {
      invoice: { include: { customer: true } },
      service: { include: { category: true } },
      staff: { include: { user: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const formatted = rows.map(row => {
    const dateObj = new Date(row.createdAt || row.invoice?.createdAt || Date.now());
    return {
      "Date": dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
      "Time": dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      "Guest Name": row.invoice?.customer?.name || "Walk-in",
      "Guest Number": row.invoice?.customer?.phone || "-",
      "Staff": row.staff?.user?.name || row.staffName || "-",
      "Invoice No": row.invoice?.invoiceNumber || "-",
      "Service": row.service?.name || row.serviceName || "-",
      "Category": row.service?.category?.name || "Other",
      "Duration": row.service?.duration || "-",
      "Qty": row.qty || 1,
      "Unit Price": toAmount(row.unitPrice || 0),
      "Discount": toAmount(row.invoice?.discount || 0),
      "Complimentary": toAmount(row.invoice?.total || 0) === 0 ? "Yes" : "-",
      "Redemption Amount": "-",
      "Redemption Sources": "-",
      "Tax": toAmount(row.taxAmount || 0),
      "Subtotal": toAmount(row.lineTotal || 0) - toAmount(row.taxAmount || 0),
      "Total": toAmount(row.lineTotal || 0)
    };
  });
  res.json(formatted);
});`;

const targetCrlf = target.replace(/\n/g, '\r\n');
if (content.includes(target)) content = content.replace(target, replacement);
else if (content.includes(targetCrlf)) content = content.replace(targetCrlf, replacement);

fs.writeFileSync('src/modules/reports/routes.js', content);
console.log("Patched service-sales logic!");
