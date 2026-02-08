'use client'

import { useQuery } from '@tanstack/react-query'
import { PartyPopper, BookOpen, Palette, Volume2, Search, Rocket, RefreshCw, CreditCard, Settings, Coffee, ChartSpline } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

import { BaseHeader } from '@/components/BaseHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { createCheckoutSession, createPortalSession } from '@/utils/stripe'
import { createClient } from '@/utils/supabase/client'



export default function SupportPage() {
  const { user: authUser } = useAuth()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('')
  usePageTitle('Support JReader - JReader');


  // Handle success/cancel messages from Stripe checkout
  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')

    if (success) {
      toast.success('Subscription successful! Welcome to JReader Supporter!')
      // React Query will automatically refetch when the component remounts
    } else if (canceled) {
      toast.error('Subscription was canceled.')
    }
  }, [searchParams])

  // Fetch user subscription data using React Query
  const { data: userSubscriptionData, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ['user-subscription', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return null

      console.log('Fetching user subscription for:', authUser.id)

      const supabase = createClient()
      const { data, error } = await supabase
        .from('Users')
        .select('tier, subscription_status, stripe_subscription_id, subscription_end_date')
        .eq('id', authUser.id)
        .single()

      if (error) {
        console.error('Error fetching user subscription:', error)
        return null
      }

      console.log('Subscription data fetched:', data)
      return data
    },
    enabled: !!authUser?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  // Show loading state only while subscription is loading (not when auth is not present)
  const shouldShowLoading = isLoadingSubscription

  // Helper function to format the end date
  const formatEndDate = (dateString: string | null) => {
    if (!dateString) return null
    const date = new Date(dateString)

    // Extract just the date part and format it
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth()
    const day = date.getUTCDate()

    return new Date(year, month, day).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleSubscribe = async (plan: 'pro') => {
    if (!authUser) {
      toast.error('Please log in to subscribe')
      return
    }

    setIsLoading(true)

    try {
      await createCheckoutSession(plan)
    } catch (error) {
      console.error('Error creating checkout session:', error)
      toast.error('Failed to start checkout. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    if (!authUser) {
      toast.error('Please log in to manage your subscription')
      return
    }

    setIsLoading(true)

    try {
      await createPortalSession()
    } catch (error) {
      console.error('Error creating portal session:', error)
      toast.error('Failed to open subscription management. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleNotifyMe = async (plan: string) => {
    setSelectedPlan(plan)
    setIsDialogOpen(true)
  }

  const handleSubmitEmail = async () => {
    if (!email.trim()) return

    setIsLoading(true)

    try {
      const supabase = createClient()

      // Get current user if logged in
      const { data: { user } } = await supabase.auth.getUser()

      console.log('Attempting to save email:', {
        email: email.trim(),
        plan: selectedPlan,
        supabaseUserId: user?.id || null,
        supabaseUserIdType: typeof user?.id,
        authContextUser: authUser,
        isLoggedIn: !!authUser,
        hasSupabaseUser: !!user
      })

      // Log the exact data being sent
      const insertData = {
        email: email.trim(),
        user_id: user?.id || null,
        plan: selectedPlan,
        status: 'pending'
      }
      console.log('Insert data:', insertData)

      // For now, let's just insert with the user ID and see what happens
      const { error } = await supabase.from('pro_notifications').upsert({
        email: email.trim(),
        user_id: user?.id || null,
        plan: selectedPlan,
        status: 'pending'
      }, {
        onConflict: 'email'
      })

      if (error) {
        console.error('Supabase error:', error)
        console.error('Error details:', error.message, error.details, error.hint)

        // Show the actual error for debugging
        toast.error(`Error: ${error.message}`)
        console.log('Full error object:', error)
        return
      }

      console.log(`Email saved for ${selectedPlan} plan: ${email}`)
      setEmail('')
      setIsDialogOpen(false)
      toast.success(`Thanks! We'll notify you when ${selectedPlan} launches.`)

    } catch (error) {
      console.error('Error saving email:', error)
      toast.error('Sorry, there was an error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const supporterFeatures = [
    {
      icon: BookOpen,
      title: 'More Book Uploads',
      description: 'Upload up to 25 books to your personal library'
    },
    {
      icon: Rocket,
      title: 'Unlimited Card Mining',
      description: 'Create as many cards as you want, whenever you want'
    },
    {
      icon: Coffee,
      title: 'Support Development',
      description: 'Help cover hosting costs and fund new features'
    },
  ]

  return (
    <div className="absolute inset-0 flex flex-col">
      <BaseHeader title="Support JReader" />
      <div className="relative flex-1 min-h-0">
                <div className="absolute inset-0 overflow-y-auto p-4">
          <div className="max-w-7xl mx-auto px-4">
          {/* Hero Section */}
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">Show Your Support 💙</h1>
            <div className="max-w-2xl mx-auto mb-6">
              <p className="text-lg text-muted-foreground mb-3">JReader stays free thanks to people who help support its ongoing development.</p>
              <p className="text-lg text-muted-foreground">If JReader makes your Japanese study easier, you can contribute $6/month to help fund new features and hosting.</p>
            </div>

            {/* Manage Subscription Button for existing subscribers */}
            {!shouldShowLoading && userSubscriptionData?.tier !== undefined && userSubscriptionData.tier > 0 && (
              <div className="mb-4">
                <Button
                  onClick={handleManageSubscription}
                  variant="outline"
                  size="lg"
                  disabled={isLoading}
                  className="mx-auto"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {isLoading ? 'Loading...' : 'Manage Subscription'}
                </Button>
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Upgrade, downgrade, or manage your billing
                </p>
              </div>
            )}

            {/* Subscription Status Indicator */}
            {!shouldShowLoading && userSubscriptionData?.subscription_status === 'canceled' && (
              <div className="max-w-md mx-auto p-4 bg-muted/50 border border-border rounded-lg mb-6">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-muted-foreground/20 flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">ℹ</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      Subscription Canceled
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      You'll continue to have access until {formatEndDate(userSubscriptionData?.subscription_end_date) || 'the end of your current billing period'}.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {/* Free Plan */}
            <Card className={`border-2 flex flex-col ${
              userSubscriptionData?.tier === 0
                ? 'border-primary shadow-lg'
                : 'border-primary/20'
            }`}>
              <CardHeader className="text-center">
                <CardTitle className="text-3xl">Community</CardTitle>
                <CardDescription>
                  <span className="text-xl text-muted-foreground">Free for everyone</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-1">
                <div className="space-y-3 flex-1">
                  <div className="flex items-start gap-3">
                    <RefreshCw className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium">Cross-Device Sync</h4>
                      <p className="text-sm text-muted-foreground">Sync your reading progress across all your devices, mobile and desktop</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Search className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium">50+ Yomitan Dictionaries</h4>
                      <p className="text-sm text-muted-foreground">Access an extensive collection of Japanese dictionaries</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Palette className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium">Dark mode and additional themes</h4>
                      <p className="text-sm text-muted-foreground">Comfortable reading in any environment</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Volume2 className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium">Word Audio</h4>
                      <p className="text-sm text-muted-foreground">Get instant access to audio files, no local storage required</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <ChartSpline className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium">Track kanji mastery and reading activity</h4>
                      <p className="text-sm text-muted-foreground">View graphs and charts of your kanji progress and reading habits over time</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <BookOpen className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium">5 Book Uploads</h4>
                      <p className="text-sm text-muted-foreground">Upload up to 5 books to your personal library</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Search className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium">Mine up to 15 Anki-compatible cards per day</h4>
                      <p className="text-sm text-muted-foreground">Sync to Anki any time via the JReader browser extension</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  {shouldShowLoading ? (
                    <>
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-4 w-3/4 mx-auto" />
                    </>
                  ) : userSubscriptionData?.tier === 0 ? (
                    <>
                      <Button
                        className="w-full bg-primary text-primary-foreground font-semibold"
                        size="lg"
                        variant="default"
                        disabled
                      >
                        Current Plan
                      </Button>

                      <p className="text-xs text-center text-muted-foreground">
                        You are currently in the Community
                      </p>
                    </>
                  ) : (
                    <>
                      <Button
                        className="w-full"
                        size="lg"
                        variant="outline"
                        disabled
                      >
                        Free Plan
                      </Button>

                      <p className="text-xs text-center text-muted-foreground">
                        Join the community for free
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Supporter Plan */}
            <Card className={`border-2 flex flex-col ${
              userSubscriptionData?.tier === 1
                ? 'border-primary shadow-lg'
                : 'border-primary/20'
            }`}>
              <CardHeader className="text-center">
                <CardTitle className="text-3xl">Supporter Tier</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold">$6</span>
                  <span className="text-muted-foreground">/month</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-1">
                <p className="text-sm text-muted-foreground mb-4">Everything from Community, plus:</p>
                <div className="space-y-3 flex-1">
                  {supporterFeatures.map((feature, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3"
                    >
                      <feature.icon className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
                      <div>
                        <h4 className="font-medium">{feature.title}</h4>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 space-y-2">
                  {shouldShowLoading ? (
                    <>
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-4 w-3/4 mx-auto" />
                    </>
                  ) : authUser && userSubscriptionData?.tier === 1 ? (
                    <>
                      <Button
                        className="w-full bg-primary text-primary-foreground font-semibold"
                        size="lg"
                        variant="default"
                        disabled
                      >
                        <PartyPopper className="h-4 w-4 mr-2" />
                        Current Plan
                      </Button>

                      <p className="text-xs text-center text-muted-foreground">
                        {userSubscriptionData?.subscription_status === 'canceled'
                          ? 'Supporter Tier (Canceled - active until end of billing period)'
                          : 'You are supporting JReader!'
                        }
                      </p>
                    </>
                  ) : authUser ? (
                    <>
                      <Button
                        onClick={() => handleSubscribe('pro')}
                        className="w-full"
                        size="lg"
                        disabled={isLoading}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        {isLoading ? 'Loading...' : 'Become a Supporter'}
                      </Button>

                      <p className="text-xs text-center text-muted-foreground">
                        Unlock unlimited mining and more features
                      </p>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => {
                          const url = new URL(window.location.href)
                          url.pathname = '/login'
                          url.searchParams.set('redirect', '/support-development')
                          window.location.href = url.toString()
                        }}
                        className="w-full"
                        size="lg"
                      >
                        Become a Supporter 💙
                      </Button>

                      <p className="text-xs text-center text-muted-foreground">
                        Sign in to get started
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Note Section */}
          <div className="max-w-2xl mx-auto p-4 bg-muted/30 border border-border rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              <span className="font-medium text-foreground">Note:</span> You can cancel your subscription anytime. If you do, your Supporter benefits stay active until the end of your current billing period.
            </p>
          </div>
        </div>
        </div>
      </div>

    </div>
  )
}
