import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const pkgs = await prisma.package.findMany({
    where: { name: 'Grooming Starter Pack' },
    include: { services: { include: { service: true } } }
  });
  console.log(JSON.stringify(pkgs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
