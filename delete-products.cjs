const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  try {
    const vi = await p.vendorItem.deleteMany();
    console.log("VendorItems deleted:", vi.count);
    const sri = await p.stockReconciliationItem.deleteMany();
    console.log("StockReconciliationItems deleted:", sri.count);
    const poi = await p.purchaseOrderItem.deleteMany();
    console.log("PurchaseOrderItems deleted:", poi.count);
    const m = await p.stockMovement.deleteMany();
    console.log("StockMovements deleted:", m.count);
    const pr = await p.product.deleteMany();
    console.log("Products deleted:", pr.count);
    console.log("DONE - All products deleted successfully!");
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await p.$disconnect();
  }
})();
