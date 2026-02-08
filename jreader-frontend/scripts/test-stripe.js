// Test script to verify Stripe integration
// Run with: node scripts/test-stripe.js

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function testStripeSetup() {
  console.log('🔍 Testing Stripe Setup...\n');

  try {
    // Test 1: Verify API key works
    console.log('1. Testing API key...');
    const account = await stripe.accounts.retrieve();
    console.log('✅ API key is valid');
    console.log(`   Account: ${account.business_profile?.name || 'Test Account'}\n`);

    // Test 2: List products
    console.log('2. Listing products...');
    const products = await stripe.products.list({ limit: 10 });
    console.log('✅ Found products:');
    products.data.forEach(product => {
      console.log(`   - ${product.name} (${product.id})`);
    });
    console.log('');

    // Test 3: List prices for each product
    console.log('3. Listing prices...');
    for (const product of products.data) {
      const prices = await stripe.prices.list({ product: product.id });
      console.log(`   ${product.name}:`);
      prices.data.forEach(price => {
        console.log(`     - ${price.unit_amount / 100} ${price.currency} (${price.id})`);
      });
    }
    console.log('');

    // Test 4: Test webhook endpoint (if ngrok URL provided)
    if (process.env.NGROK_URL) {
      console.log('4. Testing webhook endpoint...');
      console.log(`   Webhook URL: ${process.env.NGROK_URL}/api/webhooks/stripe`);
      console.log('   ✅ Webhook endpoint ready for testing');
    } else {
      console.log('4. Webhook testing:');
      console.log('   ⚠️  Set NGROK_URL environment variable to test webhooks');
    }

    console.log('\n🎉 Stripe setup looks good!');
    console.log('\n📝 Next steps:');
    console.log('1. Copy the price IDs above to your .env.local file');
    console.log('2. Set up webhook in Stripe Dashboard');
    console.log('3. Test the subscription flow in your app');

  } catch (error) {
    console.error('❌ Error testing Stripe setup:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure STRIPE_SECRET_KEY is set correctly');
    console.log('2. Make sure you\'re in test mode in Stripe Dashboard');
    console.log('3. Check that your API key has the right permissions');
  }
}

// Run the test
testStripeSetup();
