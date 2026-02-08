import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

import { stripe } from '@/lib/stripe-server';
import { getSiteUrl } from '@/utils/getSiteUrl';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { plan, successUrl, cancelUrl } = await request.json();

    // Validate the request
    if (!plan) {
      return NextResponse.json(
        { error: 'Plan is required' },
        { status: 400 }
      );
    }

    // Map plan to price ID
    const priceId = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID not configured for this plan' },
        { status: 400 }
      );
    }

    // Get the current user from Supabase
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${getSiteUrl()}/support-development?success=true`,
      cancel_url: cancelUrl || `${getSiteUrl()}/support-development?canceled=true`,
      metadata: {
        userId: user.id,
        userEmail: user.email || '',
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          userEmail: user.email || '',
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
