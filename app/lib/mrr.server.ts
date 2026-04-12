import prisma from "../db.server";

/**
 * Returns the current MRR in cents from all active RevenueEvents
 * in the current calendar month.
 */
export async function getCurrentMRR(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const events = await prisma.revenueEvent.findMany({
    where: {
      createdAt: { gte: startOfMonth },
      eventType: {
        in: [
          "checkout.session.completed",
          "invoice.payment_succeeded",
          "customer.subscription.created",
          "customer.subscription.updated",
        ],
      },
    },
    select: { amountCents: true },
  });

  return events.reduce((sum, e) => sum + e.amountCents, 0);
}

/**
 * Returns the total all-time revenue in cents.
 */
export async function getAllTimeRevenue(): Promise<number> {
  const result = await prisma.revenueEvent.aggregate({
    _sum: { amountCents: true },
    where: {
      eventType: {
        in: [
          "checkout.session.completed",
          "invoice.payment_succeeded",
        ],
      },
    },
  });
  return result._sum.amountCents ?? 0;
}

/**
 * Returns the count of active subscriptions.
 */
export async function getActiveSubscriptionCount(): Promise<number> {
  return prisma.merchantSubscription.count({
    where: { status: "active" },
  });
}

/**
 * Returns the last N revenue events for the activity feed.
 */
export async function getRecentRevenueEvents(limit = 10) {
  return prisma.revenueEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      eventType: true,
      amountCents: true,
      currency: true,
      customerEmail: true,
      productName: true,
      createdAt: true,
    },
  });
}
