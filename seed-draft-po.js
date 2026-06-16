import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  try {
    const salon = await prisma.salon.findFirst();
    if (!salon) {
      console.error("No salon found.");
      return;
    }
    console.log("Salon:", salon.name, salon.id);

    const branch = await prisma.branch.findFirst({ where: { salonId: salon.id } });
    if (!branch) {
      console.error("No branch found.");
      return;
    }
    console.log("Branch:", branch.name, branch.id);

    // Let's find or create a vendor
    let vendor = await prisma.vendor.findFirst({ where: { salonId: salon.id } });
    if (!vendor) {
      vendor = await prisma.vendor.create({
        data: {
          salonId: salon.id,
          name: "L'Oreal Professional India",
          phone: "+919876543210",
          email: "sales@loreal.in",
          address: "Mumbai, Maharashtra"
        }
      });
    }
    console.log("Vendor:", vendor.name, vendor.id);

    // Let's find a product
    const product = await prisma.product.findFirst({ where: { salonId: salon.id } });
    if (!product) {
      console.error("No product found to attach to PO.");
      return;
    }
    console.log("Product:", product.name, product.id);

    // Create a DRAFT purchase order
    const po = await prisma.purchaseOrder.create({
      data: {
        salonId: salon.id,
        branchId: branch.id,
        vendorId: vendor.id,
        status: "DRAFT",
        orderNumber: "PO-2026-0001",
        totalAmount: 1800,
        notes: "Urgent restocking of hair colors",
        items: {
          create: [
            {
              productId: product.id,
              quantityOrdered: 12,
              unitCost: 150,
              quantityReceived: 0
            }
          ]
        }
      }
    });

    console.log("Successfully seeded DRAFT Purchase Order:", po.orderNumber, po.id);
  } catch (error) {
    console.error("Error seeding PO:", error);
  } finally {
    await prisma.$disconnect();
  }
})();
