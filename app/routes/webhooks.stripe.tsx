/**
 * Garcar Enterprise — Stripe Webhook Handler
 * Route: POST /webhooks/stripe
 *
 * Handles:
 *   checkout.session.completed
 *   invoice.payment_succeeded
 *   invoice.payment_failed
 *   customer.subscription.created
 *   customer.subscription.updated
 *   customer.subscription.deleted
 *   charge.refunded
 *
 * All events write to RevenueEvent (Prisma) and update MerchantSubscription.
 * Stripe-Signature header is verified via HMAC-SHA256 before any processing.
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { json }                    from "@remix-run/node";
import Stripe                      from "stripe";
import stripe                      from "../lib/stripe.server";
import prisma                      from "../db.server";

// ── Remix requires raw body for Stripe signature verification ────────────────
export const config = { api: { bodyParser: false } };

// ─────────────────────────────────────────────────────────────────────────────
// Helper: upsert MerchantSubscription from a Stripe subscription object
// ─────────────────────────────────────────────────────────────────────────────
async function upsertSubscription(sub: Stripe.Subscription) {
  const shop        = (sub.metadata?.shop ?? sub.customer?.toString() ?? "unknown");
  const plan        = sub.items.data[0]?.price?.nickname ?? "standard";
  const stripeSubId = sub.id;
  const status      = sub.status === "active" ? "active" : sub.status;

  await prisma.merchantSubscription.upsert({
    where:  { stripeSubscriptionId: stripeSubId },
    update: { status, plan, updatedAt: new Date() },
    create: {
      shop,
      plan,
      status,
      stripeId:             sub.customer?.toString() ?? "",
      stripeSubscriptionId: stripeSubId,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: write a RevenueEvent record
// ─────────────────────────────────────────────────────────────────────────────
async function writeRevenueEvent({
  eventType,
  stripeEventId,
  amountCents,
  currency,
  customerId,
  customerEmail,
  productName,
  metadata,
}: {
  eventType:     string;
  stripeEventId: string;
  amountCents:   number;
  currency:      string;
  customerId?:   string;
  customerEmail?:string;
  productName?:  string;
  metadata?:     Record<string, string>;
}) {
  // Idempotency: skip if we've already processed this Stripe event ID
  const existing = await prisma.revenueEvent.findUnique({
    where: { stripeEventId },
  });
  if (existing) return existing;

  return prisma.revenueEvent.create({
    data: {
      eventType,
      stripeEventId,
      amountCents,
      currency:      currency.toUpperCase(),
      customerId,
      customerEmail,
      productName,
      metadata:      metadata ? JSON.stringify(metadata) : null,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main webhook action
// ─────────────────────────────────────────────────────────────────────────────
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set");
    return json({ error: "Webhook secret not configured" }, 500);
  }

  // ── Read raw body (required for HMAC verification) ──
  const rawBody  = await request.text();
  const sig      = request.headers.get("stripe-signature");

  if (!sig) {
    return json({ error: "Missing stripe-signature header" }, 400);
  }

  // ── Verify signature ──
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error("[stripe-webhook] Signature verification failed:", err.message);
    return json({ error: `Webhook signature verification failed: ${err.message}` }, 400);
  }

  console.log(`[stripe-webhook] ✅ Verified event: ${event.type} (${event.id})`);

  // ── Route event type ─────────────────────────────────────────────────────
  try {
    switch (event.type) {

      // ── One-time payment via Stripe Checkout ──────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "paid") break;

        const amountCents    = session.amount_total ?? 0;
        const currency       = session.currency ?? "usd";
        const customerEmail  = session.customer_details?.email ?? undefined;
        const customerId     = session.customer?.toString();
        const productName    = session.metadata?.product_name ?? "Garcar Product";

        await writeRevenueEvent({
          eventType:     "checkout.session.completed",
          stripeEventId: event.id,
          amountCents,
          currency,
          customerId,
          customerEmail,
          productName,
          metadata:      session.metadata as Record<string, string> ?? undefined,
        });

        console.log(`[stripe-webhook] 💰 Checkout paid: ${currency.toUpperCase()} ${(amountCents/100).toFixed(2)} — ${customerEmail}`);
        break;
      }

      // ── Subscription invoice paid ─────────────────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // Skip $0 invoices (trial starts, etc.)
        if ((invoice.amount_paid ?? 0) === 0) break;

        const amountCents    = invoice.amount_paid ?? 0;
        const currency       = invoice.currency ?? "usd";
        const customerId     = invoice.customer?.toString();
        const customerEmail  = invoice.customer_email ?? undefined;
        const productName    = invoice.lines.data[0]?.description ?? "Subscription";

        await writeRevenueEvent({
          eventType:     "invoice.payment_succeeded",
          stripeEventId: event.id,
          amountCents,
          currency,
          customerId,
          customerEmail,
          productName,
        });

        // If this is a subscription invoice, keep sub record in sync
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            invoice.subscription.toString()
          );
          await upsertSubscription(sub);
        }

        console.log(`[stripe-webhook] 💳 Invoice paid: ${currency.toUpperCase()} ${(amountCents/100).toFixed(2)} — ${customerEmail}`);
        break;
      }

      // ── Invoice payment failed ────────────────────────────────────────────
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await writeRevenueEvent({
          eventType:     "invoice.payment_failed",
          stripeEventId: event.id,
          amountCents:   0,
          currency:      invoice.currency ?? "usd",
          customerId:    invoice.customer?.toString(),
          customerEmail: invoice.customer_email ?? undefined,
          productName:   invoice.lines.data[0]?.description ?? "Subscription",
        });
        console.warn(`[stripe-webhook] ⚠️ Invoice payment failed — ${invoice.customer_email}`);
        break;
      }

      // ── New subscription ──────────────────────────────────────────────────
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(sub);
        await writeRevenueEvent({
          eventType:     "customer.subscription.created",
          stripeEventId: event.id,
          amountCents:   sub.items.data[0]?.price?.unit_amount ?? 0,
          currency:      sub.currency ?? "usd",
          customerId:    sub.customer?.toString(),
          productName:   sub.items.data[0]?.price?.nickname ?? "Subscription",
        });
        console.log(`[stripe-webhook] 🆕 Subscription created: ${sub.id}`);
        break;
      }

      // ── Subscription updated (upgrade/downgrade) ──────────────────────────
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(sub);
        console.log(`[stripe-webhook] 🔄 Subscription updated: ${sub.id} → ${sub.status}`);
        break;
      }

      // ── Subscription cancelled ────────────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeSubId = sub.id;
        await prisma.merchantSubscription.updateMany({
          where:  { stripeSubscriptionId: stripeSubId },
          data:   { status: "cancelled", updatedAt: new Date() },
        });
        await writeRevenueEvent({
          eventType:     "customer.subscription.deleted",
          stripeEventId: event.id,
          amountCents:   0,
          currency:      sub.currency ?? "usd",
          customerId:    sub.customer?.toString(),
          productName:   sub.items.data[0]?.price?.nickname ?? "Subscription",
        });
        console.log(`[stripe-webhook] ❌ Subscription cancelled: ${sub.id}`);
        break;
      }

      // ── Refund ────────────────────────────────────────────────────────────
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const refundAmount = charge.amount_refunded ?? 0;
        await writeRevenueEvent({
          eventType:     "charge.refunded",
          stripeEventId: event.id,
          amountCents:   -refundAmount, // negative to offset MRR
          currency:      charge.currency ?? "usd",
          customerId:    charge.customer?.toString(),
          customerEmail: charge.billing_details?.email ?? undefined,
          productName:   "Refund",
        });
        console.warn(`[stripe-webhook] 🔙 Refund: -${charge.currency.toUpperCase()} ${(refundAmount/100).toFixed(2)}`);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err: any) {
    console.error(`[stripe-webhook] Handler error for ${event.type}:`, err);
    // Return 200 so Stripe doesn't retry — log the error internally
    return json({ received: true, error: err.message }, 200);
  }

  return json({ received: true }, 200);
}
