import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const CURRENCY_SYMBOLS = { INR: "₹", PKR: "Rs.", USD: "$", EUR: "€", GBP: "£", AED: "AED ", SAR: "SAR " };

const salon = await prisma.salon.findFirst({ orderBy: { createdAt: "asc" } });
const currencyCode = salon?.currency || "INR";
const symbol = CURRENCY_SYMBOLS[currencyCode.toUpperCase()] || `${currencyCode} `;
console.log(`Salon currency: ${currencyCode} -> symbol: "${symbol}"`);

const templates = await prisma.messageTemplate.findMany({ select: { id: true, type: true, title: true, content: true } });
console.log(`Total templates: ${templates.length}`);

const withRs = templates.filter((t) => (t.content && t.content.includes("Rs.")));
console.log(`Templates with Rs.: ${withRs.length}`);

for (const t of withRs) {
  const newContent = t.content ? t.content.replaceAll("Rs.", symbol) : t.content;
  await prisma.messageTemplate.update({ where: { id: t.id }, data: { content: newContent } });
  console.log(`  Fixed: [${t.type}] ${t.title}`);
}

await prisma['$disconnect']();
console.log("Done!");
