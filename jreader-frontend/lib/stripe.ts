import { loadStripe } from '@stripe/stripe-js';

// Client-side Stripe instance (singleton pattern)
let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
};

// Product IDs - you'll need to replace these with your actual Stripe product IDs
export const STRIPE_PRODUCTS = {
  PRO: process.env.NEXT_PUBLIC_STRIPE_PRO_PRODUCT_ID || 'prod_pro_placeholder',
} as const;

export type SubscriptionTier = 'free' | 'pro';
