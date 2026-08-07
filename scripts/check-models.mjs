import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const models = Object.keys(prisma).filter(k => !k.startsWith('$') && typeof prisma[k] === 'object' && prisma[k]?.findMany);
console.log("Available models:", models.join(", "));

const hasEmailTemplate = models.includes('emailTemplate');
console.log("Has emailTemplate:", hasEmailTemplate);

await prisma['$disconnect']();
