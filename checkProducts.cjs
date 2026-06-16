const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const salon = await prisma.salon.findFirst();
  if (!salon) return console.log("No salon found.");
  const products = await prisma.product.findMany({ where: { salonId: salon.id } });
  console.log("Found products:", products.length);
  if (products.length > 0) {
    console.log(products[0]);
  }
}
check();
