import { headers } from 'next/headers';
import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

import { stripe } from '@/lib/stripe-server';
import { createServiceRoleClient } from '@/utils/supabase/service-role';


export async function POST(request: NextRequest) {
  console.log('🔔 Webhook received');

  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  console.log('📝 Webhook signature:', signature ? 'Present' : 'Missing');

  if (!signature) {
    console.error('❌ Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    console.log('✅ Webhook signature verified');
    console.log('📦 Event type:', event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleClient();

  try {
    console.log('🔄 Processing webhook event:', event.type);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;

        console.log('👤 User ID from metadata:', userId);
        console.log('📦 Subscription ID:', subscription.id);
        console.log('💰 Product ID:', subscription.items?.data?.[0]?.price?.product);
        console.log('📊 Subscription status:', subscription.status);
        console.log('📊 Full subscription object:', JSON.stringify(subscription, null, 2));

        if (userId) {
          // Determine the subscription tier based on the product
          let tier = 0; // Default to free
          if (subscription.items?.data?.[0]?.price?.product) {
            const productId = subscription.items.data[0].price.product as string;

            if (productId === process.env.STRIPE_PRO_PRODUCT_ID) {
              tier = 1; // Pro
              console.log('🎯 Setting tier to Pro (1)');
            } else {
              console.log('⚠️ Unknown product ID:', productId);
            }
          }

          // If subscription is canceled, keep the tier but update status
          // If subscription is deleted, reset to free tier
          let finalTier = tier;
          let finalStatus = subscription.status;
          let finalEndDate = null;

          if (subscription.cancel_at_period_end) {
            console.log('🔄 Subscription canceled at period end - keeping tier but updating status');
            finalTier = tier; // Keep current tier until end of period
            finalStatus = 'canceled'; // Mark as canceled in our system
            finalEndDate = subscription.cancel_at ? new Date((subscription.cancel_at - 1) * 1000).toISOString() : null;
          } else if (subscription.status === 'canceled') {
            console.log('🔄 Subscription canceled - keeping tier but updating status');
            finalTier = tier; // Keep current tier until end of period
            finalEndDate = subscription.cancel_at ? new Date((subscription.cancel_at - 1) * 1000).toISOString() : null;
          } else if (subscription.status === 'deleted') {
            console.log('🗑️ Subscription deleted - resetting to free tier');
            finalTier = 0; // Reset to free
            finalEndDate = null; // Clear end date
          } else {
            // Active subscription - clear any end date
            console.log('✅ Active subscription - clearing end date');
            finalEndDate = null;
          }

          console.log('💾 Updating user in Supabase...');
          console.log('📊 Final tier:', finalTier);
          console.log('📊 Final status:', finalStatus);
          console.log('📊 Final end date:', finalEndDate);

          // Upsert user subscription status in Supabase (create if doesn't exist, update if does)
          const { error } = await supabase
            .from('Users')
            .upsert({
              id: userId,
              tier: finalTier,
              stripe_subscription_id: subscription.id,
              stripe_customer_id: subscription.customer as string,
              subscription_status: finalStatus,
              subscription_end_date: finalEndDate,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'id'
            });

          if (error) {
            console.error('❌ Error updating user subscription:', error);
          } else {
            console.log('✅ User subscription updated successfully');
          }
        } else {
          console.log('⚠️ No user ID found in subscription metadata');
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        const deletedUserId = deletedSubscription.metadata?.userId;

        if (deletedUserId) {
          // Reset user to free tier when subscription is cancelled
          const { error } = await supabase
            .from('Users')
            .upsert({
              id: deletedUserId,
              tier: 0, // Reset to free
              stripe_subscription_id: null,
              subscription_status: 'canceled',
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'id'
            });

          if (error) {
            console.error('Error updating user subscription:', error);
          }
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
