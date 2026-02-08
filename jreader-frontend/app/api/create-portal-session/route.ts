import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { stripe } from '@/lib/stripe-server'
import { getSiteUrl } from '@/utils/getSiteUrl'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Get the current user from Supabase
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's subscription data
    const { data: userData, error: userError } = await supabase
      .from('Users')
      .select('stripe_customer_id, stripe_subscription_id, tier')
      .eq('id', user.id)
      .single()

    if (userError) {
      console.error('Error fetching user data:', userError)
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      )
    }

    if (!userData?.stripe_customer_id) {
      console.log('No stripe_customer_id found for user:', user.id)
      return NextResponse.json(
        { error: 'No Stripe customer found. Please contact support.' },
        { status: 404 }
      )
    }

    // Create customer portal session
    const returnUrl = `${getSiteUrl()}/support-development`

    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripe_customer_id,
      return_url: returnUrl,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creating portal session:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
