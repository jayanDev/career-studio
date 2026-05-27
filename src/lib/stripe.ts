import Stripe from "stripe";

/**
 * Lazy Stripe singleton. Returns null when STRIPE_SECRET_KEY is absent
 * so the webhook handler and any future server actions can gate on the
 * configured-or-not state rather than throwing at module load time.
 */
let cached: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    cached = null;
    return cached;
  }
  cached = new Stripe(key, {
    // Pin the API version so Stripe SDK upgrades don't silently shift
    // event shapes. Update this when intentionally migrating.
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
  });
  return cached;
}
