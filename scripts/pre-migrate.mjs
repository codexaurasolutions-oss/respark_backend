/**
 * pre-migrate.mjs
 * Runs BEFORE `prisma db push` to clean up any orphan rows that would
 * violate foreign-key constraints during schema sync.
 *
 * Problem: Railway DB has PackageService / PackageProduct rows whose
 * packageId references non-existent Package rows. When Prisma tries to
 * add the FK constraint it gets:
 *   "Cannot add or update a child row: a foreign key constraint fails"
 *
 * Fix: delete those orphan rows first using Prisma Client.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
  try {
    console.log("🔧  Pre-migrate cleanup starting...");

    // 1. Remove orphan PackageService rows
    const ps = await prisma.$executeRawUnsafe(`
      DELETE FROM PackageService
      WHERE packageId NOT IN (SELECT id FROM \`Package\`)
    `);
    console.log(`🧹  PackageService orphans removed: ${ps}`);

    // 2. Remove orphan PackageProduct rows (only if table exists)
    try {
      const pp = await prisma.$executeRawUnsafe(`
        DELETE FROM PackageProduct
        WHERE packageId NOT IN (SELECT id FROM \`Package\`)
      `);
      console.log(`🧹  PackageProduct orphans removed: ${pp}`);
    } catch (e) {
      console.log("⏭️   PackageProduct table not found, skipping.");
    }

    // 3. Remove orphan CustomerPackage rows (safety net)
    const cp = await prisma.$executeRawUnsafe(`
      DELETE FROM CustomerPackage
      WHERE packageId NOT IN (SELECT id FROM \`Package\`)
    `);
    console.log(`🧹  CustomerPackage orphans removed: ${cp}`);

    console.log("✅  Pre-migrate cleanup done.");
  } catch (err) {
    // If tables don't exist yet that's fine — Prisma will create them
    console.warn("⚠️   Pre-migrate cleanup skipped (non-fatal):", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
