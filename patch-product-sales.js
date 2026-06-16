import fs from 'fs';

let content = fs.readFileSync('src/modules/reports/routes.js', 'utf8');

const targetProductSales = `reportsRouter.get("/product-sales", async (req, res) => {
  const branchId = normalizeBranchId(req.query.branchId);
  const rows = await prisma.invoiceItem.findMany({
    where: {
      itemType: "PRODUCT",
      invoice: { is: buildInvoiceWhere(req, branchId) },
      ...(isOwnScopedStaff(req, "reports") ? { staffUserSalonId: req.user.membershipId } : {})
    },
    include: { product: true, invoice: true }
  });
  const grouped = {};
  rows.forEach((row) => {
    const key = row.productId || row.serviceName;
    if (!grouped[key]) grouped[key] = { productId: row.productId, name: row.product?.name || row.serviceName, qty: 0, sales: 0 };
    grouped[key].qty += Number(row.qty || 0);
    grouped[key].sales += toAmount(row.lineTotal);
  });
  res.json(Object.values(grouped).sort((a, b) => b.sales - a.sales));
});`;

const replacementProductSales = `reportsRouter.get("/product-sales", async (req, res) => {
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

const targetCrlf = targetProductSales.replace(/\n/g, '\r\n');
if (content.includes(targetProductSales)) {
  content = content.replace(targetProductSales, replacementProductSales);
  fs.writeFileSync('src/modules/reports/routes.js', content);
  console.log("Patched product-sales in backend!");
} else if (content.includes(targetCrlf)) {
  content = content.replace(targetCrlf, replacementProductSales);
  fs.writeFileSync('src/modules/reports/routes.js', content);
  console.log("Patched product-sales in backend!");
} else {
  console.log("product-sales target not found");
}
