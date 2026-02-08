# Stripe Subscription Setup Guide

## Environment Variables Required

Add these environment variables to your `.env.local` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Product IDs (replace with your actual product IDs from Stripe dashboard)
STRIPE_PRO_PRODUCT_ID=prod_your_pro_product_id
STRIPE_UNLIMITED_PRODUCT_ID=prod_your_unlimited_product_id

# Stripe Price IDs (replace with your actual price IDs from Stripe dashboard)
NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_your_pro_price_id
NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID=price_your_unlimited_price_id
```

## Steps to Complete Setup

### 1. Get Your Stripe Keys
1. Go to your [Stripe Dashboard](https://dashboard.stripe.com/)
2. Make sure you're in **Test Mode** (toggle in the top right)
3. Go to **Developers > API keys**
4. Copy your **Publishable key** and **Secret key**

### 2. Get Your Product and Price IDs
1. Go to **Products** in your Stripe Dashboard
2. For each of your Pro and Unlimited products:
   - Click on the product
   - Copy the **Product ID** (starts with `prod_`)
   - Click on the pricing plan
   - Copy the **Price ID** (starts with `price_`)

### 3. Set Up Webhook
1. Go to **Developers > Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Set the endpoint URL to: `https://your-domain.com/api/webhooks/stripe`
   - For local development, you can use ngrok: `https://your-ngrok-url.ngrok.io/api/webhooks/stripe`
4. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the **Webhook signing secret** (starts with `whsec_`)

### 4. Update Supabase Database
Make sure your `Users` table has these columns:
- `tier` (integer, default: 0) - 0 = free, 1 = pro, 2 = unlimited
- `subscription_status` (text, nullable)
- `stripe_subscription_id` (text, nullable)
- `stripe_customer_id` (text, nullable)

You can add these columns in your Supabase dashboard under **Table Editor > Users**.

**Note**: The existing system uses numeric tiers (0 = free, 1 = pro, 2 = unlimited), so we're updating the `tier` column instead of creating a new `subscription_tier` column.

## Testing the Integration

### Step 1: Get Your Stripe Information
Run the test script to get your product and price IDs:
```bash
# Set your Stripe secret key first
export STRIPE_SECRET_KEY=sk_test_your_secret_key

# Run the test script
node scripts/test-stripe.js
```

This will show you all your products and their price IDs. Copy these to your `.env.local` file.

### Step 2: Set Up Local Webhook Testing

#### Option A: Using ngrok (Recommended)
1. Install ngrok: `npm install -g ngrok`
2. Start your app: `npm run dev`
3. In another terminal: `ngrok http 3000`
4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. Set up webhook in Stripe Dashboard with URL: `https://your-ngrok-url.ngrok.io/api/webhooks/stripe`

#### Option B: Using Stripe CLI
1. Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
2. Login: `stripe login`
3. Forward webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
4. Copy the webhook secret provided

### Step 3: Test the Complete Flow
1. Start your development server: `npm run dev`
2. Go to `/support-development` page
3. Click "Subscribe to Pro" or "Subscribe to Unlimited"
4. You should be redirected to Stripe Checkout
5. Use Stripe's test card numbers (e.g., `4242 4242 4242 4242`)
6. After successful payment, you should be redirected back with a success message
7. Check your Supabase `users` table to see the subscription data updated

### Step 4: Test Webhook Manually (Optional)
```bash
# Set your webhook secret and URL
export STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
export WEBHOOK_URL=http://localhost:3000/api/webhooks/stripe

# Test webhook functionality
node scripts/test-webhook.js
```

## Important Notes

- **Test Mode**: Make sure you're in Stripe test mode during development
- **Webhook URL**: For production, update the webhook URL to your actual domain
- **Error Handling**: Check the browser console and server logs for any errors
- **Database**: Ensure your Supabase `users` table has the required columns

## Troubleshooting

- If checkout doesn't work, check that all environment variables are set correctly
- If webhooks aren't working, verify the webhook URL and secret
- If user subscription isn't updating, check the webhook logs in Stripe Dashboard
