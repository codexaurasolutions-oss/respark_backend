import { prisma } from "./prisma.js";

export const runExpiredDemoCleanup = async ({ actorName = "SYSTEM", salonId = null } = {}) => {
  const now = new Date();
  const where = {
    status: "TRIAL",
    endsAt: { lt: now },
    ...(salonId ? { salonId } : {})
  };

  const expiredTrials = await prisma.subscription.findMany({
    where,
    include: {
      salon: true
    }
  });

  if (!expiredTrials.length) {
    return { cleaned: 0, subscriptions: [] };
  }

  const cleaned = [];
  for (const subscription of expiredTrials) {
    const result = await prisma.$transaction(async (tx) => {
      const updatedSubscription = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "EXPIRED"
        }
      });

      const updatedSalon = await tx.salon.update({
        where: { id: subscription.salonId },
        data: {
          status: "EXPIRED"
        }
      });

      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: subscription.id,
          action: "TRIAL_AUTO_EXPIRED",
          createdBy: actorName,
          fromStatus: subscription.status,
          toStatus: "EXPIRED",
          fromPaymentStatus: subscription.paymentStatus || "PENDING",
          toPaymentStatus: subscription.paymentStatus || "PENDING",
          notes: "Trial auto-disabled after expiry"
        }
      });

      return {
        subscription: updatedSubscription,
        salon: updatedSalon
      };
    });

    cleaned.push(result);
  }

  return {
    cleaned: cleaned.length,
    subscriptions: cleaned
  };
};
