import fs from 'fs';

let content = fs.readFileSync('src/modules/reports/routes-extended.js', 'utf8');

const targetSalesSummary = `  reportsRouter.get("/sales-summary-list", async (req, res) => {
    const branchId = normalizeBranchId(req.query.branchId);
    const invoices = await prisma.invoice.findMany({
      where: buildInvoiceWhere(req, branchId),
      include: { customer: true, items: true },
      orderBy: { createdAt: "desc" }
    });
    res.json(invoices.map(inv => ({
      date: new Date(inv.createdAt).toLocaleDateString(),
      invoiceNumber: inv.invoiceNumber,
      customer: inv.customer?.name || "Walk-in",
      services: inv.items.filter(i => i.itemType === "SERVICE").length,
      products: inv.items.filter(i => i.itemType === "PRODUCT").length,
      discount: toAmount(inv.discount),
      tax: toAmount(inv.tax),
      total: toAmount(inv.total),
      paid: toAmount(inv.paidAmount),
      due: Math.max(0, toAmount(inv.total) - toAmount(inv.paidAmount) - toAmount(inv.refundAmount))
    })));
  });`;

const replacementSalesSummary = `  reportsRouter.get("/sales-summary-list", async (req, res) => {
    const branchId = normalizeBranchId(req.query.branchId);
    const invoices = await prisma.invoice.findMany({
      where: buildInvoiceWhere(req, branchId),
      include: { customer: true, items: true, payments: true },
      orderBy: { createdAt: "desc" }
    });
    res.json(invoices.map(inv => {
      const servicesNames = inv.items.filter(i => i.itemType === "SERVICE").map(i => i.serviceName).filter(Boolean).join(", ");
      const productsNames = inv.items.filter(i => i.itemType === "PRODUCT").map(i => i.serviceName).filter(Boolean).join(", ");
      const itemsList = [servicesNames, productsNames].filter(Boolean).join(" | ");
      const paymentModes = inv.payments.map(p => p.mode).filter(Boolean).join(", ");

      const dateObj = new Date(inv.createdAt || Date.now());

      return {
        "DATE": dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'),
        "TIME": dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        "INVOICE NO": inv.invoiceNumber,
        "GUEST NAME": inv.customer?.name || "Walk-in",
        "GUEST NUMBER": inv.customer?.phone || "-",
        "ITEMS": itemsList || "-",
        "GROSS AMOUNT": toAmount(inv.subtotal || inv.total),
        "DISCOUNT": toAmount(inv.discount),
        "TAX": toAmount(inv.tax),
        "NET TOTAL": toAmount(inv.total),
        "PAID AMOUNT": toAmount(inv.paidAmount),
        "DUE AMOUNT": Math.max(0, toAmount(inv.total) - toAmount(inv.paidAmount) - toAmount(inv.refundAmount)),
        "PAYMENT MODE": paymentModes || "Unpaid"
      };
    }));
  });`;

const targetCrlf = targetSalesSummary.replace(/\n/g, '\r\n');
if (content.includes(targetSalesSummary)) content = content.replace(targetSalesSummary, replacementSalesSummary);
else if (content.includes(targetCrlf)) content = content.replace(targetCrlf, replacementSalesSummary);

fs.writeFileSync('src/modules/reports/routes-extended.js', content);
console.log("Patched sales-summary-list!");
