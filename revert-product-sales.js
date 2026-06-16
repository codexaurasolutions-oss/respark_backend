import fs from 'fs';

let content = fs.readFileSync('src/modules/reports/routes.js', 'utf8');

const targetProductSalesDetailed = `reportsRouter.get("/product-sales", async (req, res) => {
  const branchId = normalizeBranchId(req.query.branchId);
  const rows = await prisma.invoiceItem.findMany({
    where: {
      itemType: "PRODUCT",
      invoice: { is: buildInvoiceWhere(req, branchId) },
      ...(isOwnScopedStaff(req, "reports") ? { staffUserSalonId: req.user.membershipId } : {})
    },
    include: {
      invoice: { include: { customer: true } },
      product: { include: { category: true } },
      staffUserSalon: { include: { user: true } }
    },
    orderBy: { invoice: { createdAt: "desc" } }
  });

  const formatted = rows.map(r => {
    const isComplimentary = toAmount(r.lineTotal) === 0 && toAmount(r.unitPrice) > 0;
    const dateObj = new Date(r.invoice?.createdAt || Date.now());

    return {
      "Date": dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
      "Time": dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      "Guest Name": r.invoice?.customer?.name || "Walk-in",
      "Guest Number": r.invoice?.customer?.phone || "-",
      "Staff": r.staffUserSalon?.user?.name || r.staffName || "-",
      "Invoice No": r.invoice?.invoiceNumber || "-",
      "Product": r.product?.name || r.serviceName,
      "Category": r.product?.category?.name || "-",
      "Qty": r.qty,
      "Unit Price": toAmount(r.unitPrice),
      "Discount": toAmount(r.unitPrice * r.qty) - toAmount(r.lineTotal) - toAmount(r.appliedBenefitValue || 0),
      "Complimentary": isComplimentary ? "Yes" : "No",
      "Redemption Amount": toAmount(r.appliedBenefitValue),
      "Redemption Sources": r.appliedBenefitType || "-",
      "Tax": toAmount(r.lineTotal * (Number(r.taxPct || 0) / 100)),
      "Subtotal": toAmount(r.lineTotal),
      "Total": toAmount(r.lineTotal) + toAmount(r.lineTotal * (Number(r.taxPct || 0) / 100))
    };
  });
  res.json(formatted);
});`;

const replacementProductSalesGrouped = `reportsRouter.get("/product-sales", async (req, res) => {
  const branchId = normalizeBranchId(req.query.branchId);
  const rows = await prisma.invoiceItem.findMany({
    where: {
      itemType: "PRODUCT",
      invoice: { is: buildInvoiceWhere(req, branchId) },
      ...(isOwnScopedStaff(req, "reports") ? { staffUserSalonId: req.user.membershipId } : {})
    },
    include: { product: { include: { category: true } }, invoice: true }
  });
  const grouped = {};
  rows.forEach((row) => {
    const key = row.productId || row.serviceName;
    if (!grouped[key]) {
      grouped[key] = { 
        productId: row.productId, 
        name: row.product?.name || row.serviceName, 
        category: row.product?.category?.name || "-",
        qty: 0, 
        sales: 0 
      };
    }
    grouped[key].qty += Number(row.qty || 0);
    grouped[key].sales += toAmount(row.lineTotal);
  });
  res.json(Object.values(grouped).sort((a, b) => b.sales - a.sales));
});`;

const targetCrlf = targetProductSalesDetailed.replace(/\n/g, '\r\n');
if (content.includes(targetProductSalesDetailed)) {
  content = content.replace(targetProductSalesDetailed, replacementProductSalesGrouped);
} else if (content.includes(targetCrlf)) {
  content = content.replace(targetCrlf, replacementProductSalesGrouped);
} else {
  console.log("Could not find product-sales detailed code to replace");
}

fs.writeFileSync('src/modules/reports/routes.js', content);
console.log("Reverted product-sales in backend");
