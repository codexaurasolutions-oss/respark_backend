import fs from 'fs';

let content = fs.readFileSync('src/modules/reports/routes.js', 'utf8');

const targetServiceSales = `reportsRouter.get("/service-sales", async (req, res) => {
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
    orderBy: { invoice: { createdAt: "desc" } }
  });`;

const replacementServiceSales = `reportsRouter.get("/service-sales", async (req, res) => {
  const branchId = normalizeBranchId(req.query.branchId);
  const rows = await prisma.invoiceItem.findMany({
    where: {
      itemType: "SERVICE",
      invoice: { is: buildInvoiceWhere(req, branchId) },
      ...(isOwnScopedStaff(req, "reports") ? { staffUserSalonId: req.user.membershipId } : {})
    },
    include: {
      invoice: { include: { customer: true } },
      staffUserSalon: { include: { user: true } }
    },
    orderBy: { invoice: { createdAt: "desc" } }
  });

  // Fetch services manually to get category
  const services = await prisma.service.findMany({
    where: { salonId: req.salonId },
    include: { category: true }
  });
  const serviceMap = {};
  services.forEach(s => serviceMap[s.id] = s);
`;

// Also update the formatted mapping to use serviceMap and staffUserSalon
const targetFormattedService = `  const formatted = rows.map(r => {
    const isComplimentary = toAmount(r.lineTotal) === 0 && toAmount(r.unitPrice) > 0;
    const dateObj = new Date(r.invoice?.createdAt || Date.now());

    return {
      "Date": dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
      "Time": dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      "Guest Name": r.invoice?.customer?.name || "Walk-in",
      "Guest Number": r.invoice?.customer?.phone || "-",
      "Staff": r.staff?.user?.name || r.staffName || "-",
      "Invoice No": r.invoice?.invoiceNumber || "-",
      "Service": r.service?.name || r.serviceName,
      "Category": r.service?.category?.name || "-",
      "Duration": r.service?.durationMin || "-",`;

const replacementFormattedService = `  const formatted = rows.map(r => {
    const isComplimentary = toAmount(r.lineTotal) === 0 && toAmount(r.unitPrice) > 0;
    const dateObj = new Date(r.invoice?.createdAt || Date.now());
    const serviceObj = r.serviceId ? serviceMap[r.serviceId] : null;

    return {
      "Date": dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
      "Time": dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      "Guest Name": r.invoice?.customer?.name || "Walk-in",
      "Guest Number": r.invoice?.customer?.phone || "-",
      "Staff": r.staffUserSalon?.user?.name || r.staffName || "-",
      "Invoice No": r.invoice?.invoiceNumber || "-",
      "Service": serviceObj?.name || r.serviceName,
      "Category": serviceObj?.category?.name || "-",
      "Duration": serviceObj?.durationMin || "-",`;

const targetCrlf1 = targetServiceSales.replace(/\n/g, '\r\n');
if (content.includes(targetServiceSales)) content = content.replace(targetServiceSales, replacementServiceSales);
else if (content.includes(targetCrlf1)) content = content.replace(targetCrlf1, replacementServiceSales);

const targetCrlf2 = targetFormattedService.replace(/\n/g, '\r\n');
if (content.includes(targetFormattedService)) content = content.replace(targetFormattedService, replacementFormattedService);
else if (content.includes(targetCrlf2)) content = content.replace(targetCrlf2, replacementFormattedService);

// Also need to fix staffUserSalon for Product Sales since I used `staff` there too!
const targetProductSales2 = `    include: {
      invoice: { include: { customer: true } },
      product: { include: { category: true } },
      staff: { include: { user: true } }
    },`;
const replacementProductSales2 = `    include: {
      invoice: { include: { customer: true } },
      product: { include: { category: true } },
      staffUserSalon: { include: { user: true } }
    },`;
const targetCrlf3 = targetProductSales2.replace(/\n/g, '\r\n');
if (content.includes(targetProductSales2)) content = content.replace(targetProductSales2, replacementProductSales2);
else if (content.includes(targetCrlf3)) content = content.replace(targetCrlf3, replacementProductSales2);

const targetFormattedProduct = `      "Staff": r.staff?.user?.name || r.staffName || "-",`;
const replacementFormattedProduct = `      "Staff": r.staffUserSalon?.user?.name || r.staffName || "-",`;
const targetCrlf4 = targetFormattedProduct.replace(/\n/g, '\r\n');
if (content.includes(targetFormattedProduct)) content = content.replace(targetFormattedProduct, replacementFormattedProduct);
else if (content.includes(targetCrlf4)) content = content.replace(targetCrlf4, replacementFormattedProduct);

fs.writeFileSync('src/modules/reports/routes.js', content);
console.log("Patched service-sales and product-sales bugs!");
