-- AlterTable
ALTER TABLE "ServiceConsumable" ADD COLUMN "variation" VARCHAR(20);

-- DropIndex
DROP INDEX "ServiceConsumable_serviceId_productId_key";

-- CreateIndex
CREATE UNIQUE INDEX "ServiceConsumable_serviceId_productId_variation_key" ON "ServiceConsumable"("serviceId", "productId", "variation");
