import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook handler.
 *
 * Verifies the request signature against STRIPE_WEBHOOK_SECRET, then
 * applies the event to the Subscription / Payment tables.
 *
 * Events handled:
 *   checkout.session.completed         → create / upgrade subscription
 *   customer.subscription.created      → ensure local subscription row exists
 *   customer.subscription.updated      → update status + period boundaries
 *   customer.subscription.deleted      → mark canceled
 *   invoice.payment_succeeded          → record Payment row
 *   invoice.payment_failed             → mark past_due
 *
 * Unknown event types are accepted with 200 so Stripe doesn't retry;
 * we log them for later review.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();

  if (!secret || !stripe) {
    return NextResponse.json(
      { error: "Stripe webhook not configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // Raw request body required for signature verification.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.warn("[stripe-webhook] signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        console.info("[stripe-webhook] unhandled event type:", event.type);
    }
  } catch (error) {
    console.error("[stripe-webhook] handler failed for", event.type, error);
    // Return 500 so Stripe retries — better than silently losing the event.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/* -------------------------------------------------------------------------- */
/*  Handlers                                                                   */
/* -------------------------------------------------------------------------- */

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  if (!userId || !subscriptionId) {
    console.warn(
      "[stripe-webhook] checkout.session.completed missing userId or subscription",
      { userId, subscriptionId },
    );
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await upsertSubscriptionForUser(userId, subscription, customerId);
}

async function handleSubscriptionUpsert(subscription: Stripe.Subscription) {
  const existing = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { userId: true },
  });
  if (!existing) {
    console.warn("[stripe-webhook] subscription.upsert with no local row:", subscription.id);
    return;
  }
  await upsertSubscriptionForUser(existing.userId, subscription);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: "canceled",
      cancelAtPeriodEnd: false,
    },
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Stripe SDK shapes shift between versions; read defensively.
  const subscriptionId =
    typeof (invoice as { subscription?: unknown }).subscription === "string"
      ? ((invoice as { subscription?: string }).subscription ?? null)
      : null;
  const paymentIntentId =
    typeof (invoice as { payment_intent?: unknown }).payment_intent === "string"
      ? ((invoice as { payment_intent?: string }).payment_intent ?? "")
      : "";
  const userId = invoice.metadata?.userId ?? null;

  if (!userId && !subscriptionId) return;

  const localSub = subscriptionId
    ? await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subscriptionId } })
    : null;
  const resolvedUserId = userId ?? localSub?.userId;
  if (!resolvedUserId) return;

  await prisma.payment.create({
    data: {
      userId: resolvedUserId,
      subscriptionId: localSub?.id,
      stripePaymentIntentId: paymentIntentId,
      stripeInvoiceId: invoice.id ?? "",
      amount: ((invoice.amount_paid ?? 0) / 100) as unknown as number,
      currency: invoice.currency ?? "lkr",
      status: "succeeded",
      description: invoice.description ?? "",
      invoiceUrl: invoice.hosted_invoice_url ?? "",
    },
  });
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof (invoice as { subscription?: unknown }).subscription === "string"
      ? ((invoice as { subscription?: string }).subscription ?? null)
      : null;
  if (!subscriptionId) return;
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: { status: "past_due" },
  });
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function upsertSubscriptionForUser(
  userId: string,
  subscription: Stripe.Subscription,
  customerIdHint?: string,
) {
  const priceId = subscription.items.data[0]?.price.id;
  const plan = priceId
    ? await prisma.plan.findFirst({
        where: {
          OR: [
            { stripePriceMonthlyId: priceId },
            { stripePriceYearlyId: priceId },
          ],
        },
        select: { id: true, stripePriceYearlyId: true },
      })
    : null;

  const billingInterval =
    plan?.stripePriceYearlyId && plan.stripePriceYearlyId === priceId ? "year" : "month";

  // current_period_* lives on the subscription item in newer Stripe API
  // shapes; read defensively to survive SDK version drift.
  const item = subscription.items.data[0] as
    | { current_period_start?: number; current_period_end?: number }
    | undefined;
  const periodStartSec = item?.current_period_start ?? null;
  const periodEndSec = item?.current_period_end ?? null;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : (subscription.customer?.id ?? customerIdHint ?? "");

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planId: plan?.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status: mapStatus(subscription.status),
      currentPeriodStart: periodStartSec ? new Date(periodStartSec * 1000) : null,
      currentPeriodEnd: periodEndSec ? new Date(periodEndSec * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
      billingInterval,
    },
    update: {
      planId: plan?.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status: mapStatus(subscription.status),
      currentPeriodStart: periodStartSec ? new Date(periodStartSec * 1000) : null,
      currentPeriodEnd: periodEndSec ? new Date(periodEndSec * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
      billingInterval,
    },
  });
}

const STATUS_MAP: Record<
  string,
  "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired"
> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "unpaid",
  incomplete: "incomplete",
  incomplete_expired: "incomplete_expired",
  paused: "past_due",
};

function mapStatus(stripeStatus: string) {
  return STATUS_MAP[stripeStatus] ?? "incomplete";
}
