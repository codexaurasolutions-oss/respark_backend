import { prisma } from "./prisma.js";

export const startLoyaltyExpiryScheduler = () => {
  const runExpiry = async () => {
    try {
      const now = new Date();
      const expiredTransactions = await prisma.loyaltyTransaction.findMany({
        where: {
          type: "EARN",
          expiresAt: { lte: now },
          points: { gt: 0 }
        },
        include: { customer: true }
      });

      for (const txn of expiredTransactions) {
        const alreadyExpired = await prisma.loyaltyTransaction.findFirst({
          where: {
            salonId: txn.salonId,
            customerId: txn.customerId,
            type: "EXPIRE",
            note: { contains: `Expiry of txn ${txn.id}` }
          }
        });
        if (alreadyExpired) continue;

        const customer = await prisma.customer.findUnique({
          where: { id: txn.customerId },
          select: { loyaltyPoints: true }
        });
        const currentBalance = Number(customer?.loyaltyPoints || 0);
        const pointsToExpire = Math.min(Number(txn.points), currentBalance);
        if (pointsToExpire <= 0) continue;

        const newBalance = currentBalance - pointsToExpire;
        await prisma.$transaction(async (tx) => {
          await tx.customer.update({
            where: { id: txn.customerId },
            data: { loyaltyPoints: newBalance }
          });
          await tx.loyaltyTransaction.create({
            data: {
              salonId: txn.salonId,
              branchId: txn.branchId,
              customerId: txn.customerId,
              invoiceId: txn.invoiceId,
              createdByMembershipId: null,
              type: "EXPIRE",
              points: -pointsToExpire,
              balanceAfter: newBalance,
              note: `Expiry of txn ${txn.id}`
            }
          });
        });
      }

      if (expiredTransactions.length > 0) {
        console.log(`[Loyalty] Expired ${expiredTransactions.length} old loyalty transactions`);
      }
    } catch (error) {
      console.error("[Loyalty] Expiry scheduler error:", error);
    }
  };

  runExpiry();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(runExpiry, TWENTY_FOUR_HOURS);
};
