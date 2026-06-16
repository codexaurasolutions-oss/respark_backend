import fs from 'fs';

const filePath = 'src/modules/reports/routes-extended.js';
let content = fs.readFileSync(filePath, 'utf8');

// Helper script to inject start/end date logic to all non-buildInvoiceWhere queries

const buildDateFilterStr = `
const buildDateFilter = (req, field = "createdAt") => {
  const filter = {};
  if (req.query.start) filter.gte = new Date(req.query.start);
  if (req.query.end) {
    const end = new Date(req.query.end);
    end.setUTCHours(23, 59, 59, 999);
    filter.lte = end;
  }
  return Object.keys(filter).length > 0 ? { [field]: filter } : {};
};
`;

if (!content.includes('buildDateFilter')) {
  content = content.replace(
    'export const registerExtendedReports = (reportsRouter, prisma, buildInvoiceWhere) => {',
    `export const registerExtendedReports = (reportsRouter, prisma, buildInvoiceWhere) => {${buildDateFilterStr}`
  );
}

// Replace all hardcoded { salonId: req.salonId } and similar with appended date filters where appropriate.

const replacements = [
  // staff-attendance
  { find: 'where: { salonId: req.salonId },\n      include: { staff: { include: { user: true } } },', 
    replace: 'where: { salonId: req.salonId, ...buildDateFilter(req, "date") },\n      include: { staff: { include: { user: true } } },' },
  
  // membership-redemption
  { find: 'where: { customerMembership: { salonId: req.salonId } },\n      include: { customerMembership: { include: { customer: true, membershipPlan: true } } },',
    replace: 'where: { customerMembership: { salonId: req.salonId }, ...buildDateFilter(req) },\n      include: { customerMembership: { include: { customer: true, membershipPlan: true } } },' },

  // package-redemption
  { find: 'where: { customerPackage: { salonId: req.salonId } },\n      include: { customerPackage: { include: { customer: true, package: true } } },',
    replace: 'where: { customerPackage: { salonId: req.salonId }, ...buildDateFilter(req) },\n      include: { customerPackage: { include: { customer: true, package: true } } },' },

  // gift-card-sold
  { find: 'where: { salonId: req.salonId },\n      include: { issuedTo: true, branch: true },',
    replace: 'where: { salonId: req.salonId, ...buildDateFilter(req) },\n      include: { issuedTo: true, branch: true },' },

  // gift-card-redemption
  { find: 'where: { giftCard: { salonId: req.salonId } },\n      include: { giftCard: true, invoice: true, customer: true },',
    replace: 'where: { giftCard: { salonId: req.salonId }, ...buildDateFilter(req) },\n      include: { giftCard: true, invoice: true, customer: true },' },

  // advance-received
  { find: 'where: { salonId: req.salonId, type: "ADVANCE" },\n      include: { invoice: { include: { customer: true, items: true } } },',
    replace: 'where: { salonId: req.salonId, type: "ADVANCE", ...buildDateFilter(req) },\n      include: { invoice: { include: { customer: true, items: true } } },' },

  // balance-received
  { find: 'where: { salonId: req.salonId, type: "BALANCE" },\n      include: { invoice: { include: { customer: true, items: true } } },',
    replace: 'where: { salonId: req.salonId, type: "BALANCE", ...buildDateFilter(req) },\n      include: { invoice: { include: { customer: true, items: true } } },' },

  // guest-followups
  { find: 'where: { salonId: req.salonId },\n      orderBy: { createdAt: "desc" }',
    replace: 'where: { salonId: req.salonId, ...buildDateFilter(req) },\n      orderBy: { createdAt: "desc" }' },

  // inventory-transaction
  { find: 'where: { salonId: req.salonId, ...(branchId ? { branchId } : {}) },\n      include: { product: true, branch: true },',
    replace: 'where: { salonId: req.salonId, ...(branchId ? { branchId } : {}), ...buildDateFilter(req) },\n      include: { product: true, branch: true },' },

  // complimentary
  { find: 'where: { salonId: req.salonId, total: 0, status: "PAID" },\n      include: { customer: true, items: true },',
    replace: 'where: { salonId: req.salonId, total: 0, status: "PAID", ...buildDateFilter(req) },\n      include: { customer: true, items: true },' },

  // material-received
  { find: 'where: { salonId: req.salonId, movementType: "PURCHASE_RECEIVED" },\n      include: { product: true },',
    replace: 'where: { salonId: req.salonId, movementType: "PURCHASE_RECEIVED", ...buildDateFilter(req) },\n      include: { product: true },' },

  // reconcile-stock
  { find: 'where: { salonId: req.salonId },\n      orderBy: { createdAt: "desc" }',
    replace: 'where: { salonId: req.salonId, ...buildDateFilter(req) },\n      orderBy: { createdAt: "desc" }' },

  // consumable-tracking
  { find: 'where: { salonId: req.salonId, movementType: "CONSUMABLE_USAGE" },\n      include: { product: true },',
    replace: 'where: { salonId: req.salonId, movementType: "CONSUMABLE_USAGE", ...buildDateFilter(req) },\n      include: { product: true },' },

  // purchase-order
  { find: 'where: { salonId: req.salonId },\n      include: { vendor: true, items: { include: { product: true } } },',
    replace: 'where: { salonId: req.salonId, ...buildDateFilter(req) },\n      include: { vendor: true, items: { include: { product: true } } },' },

  // daily-stock
  { find: 'where: { salonId: req.salonId, ...(branchId ? { branchId } : {}) },\n      include: { product: { include: { category: true } } },',
    replace: 'where: { salonId: req.salonId, ...(branchId ? { branchId } : {}), ...buildDateFilter(req) },\n      include: { product: { include: { category: true } } },' },

  // stock-transaction
  { find: 'where: { salonId: req.salonId, ...(branchId ? { branchId } : {}) },\n      include: { product: true },',
    replace: 'where: { salonId: req.salonId, ...(branchId ? { branchId } : {}), ...buildDateFilter(req) },\n      include: { product: true },' },

  // pnl-report invoices
  { find: 'where: { salonId: req.salonId, status: { not: "CANCELLED" } }',
    replace: 'where: { salonId: req.salonId, status: { not: "CANCELLED" }, ...buildDateFilter(req) }' },

  // pnl-report expenses
  { find: 'where: { salonId: req.salonId, status: { in: ["APPROVED", "PAID"] } }',
    replace: 'where: { salonId: req.salonId, status: { in: ["APPROVED", "PAID"] }, ...buildDateFilter(req) }' },

  // coupon-redemption
  { find: 'where: { coupon: { salonId: req.salonId } },\n      include: { coupon: true, invoice: true, customer: true },',
    replace: 'where: { coupon: { salonId: req.salonId }, ...buildDateFilter(req) },\n      include: { coupon: true, invoice: true, customer: true },' },
];

for (const rep of replacements) {
  content = content.replace(rep.find, rep.replace);
  // Also try CRLF replacement
  const findCrlf = rep.find.replace(/\\n/g, '\\r\\n');
  content = content.replace(findCrlf, rep.replace);
}

fs.writeFileSync(filePath, content);
console.log("Patched extended routes for date filtering!");
