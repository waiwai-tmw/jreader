'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'

export function LandingAuthCta() {
  const { user, isLoading } = useAuth()

  if (isLoading) return null

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild>
          <Link href="/mining">Get started</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild>
        <Link href="/dashboard">Dashboard</Link>
      </Button>
    </div>
  )
}


