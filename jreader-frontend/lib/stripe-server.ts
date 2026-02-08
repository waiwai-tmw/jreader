import Stripe from 'stripe';

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

// Server-side product and price IDs
export const STRIPE_PRODUCTS = {
  pro: {
    productId: process.env.STRIPE_PRO_PRODUCT_ID || 'prod_pro_placeholder',
    priceId: process.env.STRIPE_PRO_PRICE_ID || 'price_pro_placeholder',
  },
} as const;
