// Test script to simulate webhook events
// Run with: node scripts/test-webhook.js

import Stripe from 'stripe';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function testWebhook() {
  console.log('🧪 Testing Webhook...\n');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/stripe';

  if (!webhookSecret) {
    console.error('❌ STRIPE_WEBHOOK_SECRET not set');
    return;
  }

  try {
    // Create a test subscription event
    const testEvent = {
      id: 'evt_test_webhook',
      object: 'event',
      api_version: '2024-12-18.acacia',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'sub_test_webhook',
          object: 'subscription',
          status: 'active',
          metadata: {
            userId: 'test-user-id',
            userEmail: 'test@example.com'
          },
          items: {
            data: [{
              price: {
                product: process.env.STRIPE_PRO_PRODUCT_ID || 'prod_test'
              }
            }]
          },
          customer: 'cus_test_webhook'
        }
      },
      type: 'customer.subscription.created'
    };

    // Create the webhook signature
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify(testEvent);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    console.log('📤 Sending test webhook...');
    console.log(`   URL: ${webhookUrl}`);
    console.log(`   Event: ${testEvent.type}`);
    console.log(`   User ID: ${testEvent.data.object.metadata.userId}`);

    // Send the webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': `t=${timestamp},v1=${signature}`
      },
      body: payload
    });

    if (response.ok) {
      console.log('✅ Webhook sent successfully!');
      console.log(`   Status: ${response.status}`);
    } else {
      console.log('❌ Webhook failed');
      console.log(`   Status: ${response.status}`);
      const errorText = await response.text();
      console.log(`   Error: ${errorText}`);
    }

  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
  }
}

// Run the test
testWebhook();
