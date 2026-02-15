'use client'

import { BookOpen } from "lucide-react"
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'
import { isValidUsername } from '@/lib/client-auth'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const { user, isLoading } = useAuth()
  const router = useRouter()
  usePageTitle('Login - JReader');
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [redirectInfo, setRedirectInfo] = useState<{
    path: string;
    displayName: string;
    description: string;
  } | null>(null)
  
  useEffect(() => {
    // Store the redirect URL from query parameters if it exists
    const redirectUrl = searchParams.get('redirect')
    if (redirectUrl) {
      localStorage.setItem('redirectAfterLogin', redirectUrl)
      
      // Parse the redirect URL to show user-friendly information
      try {
        const url = new URL(redirectUrl, window.location.origin)
        const path = url.pathname
        
        // Map paths to user-friendly names
        const pathInfo = {
          '/library': {
            displayName: 'Your Library',
            description: 'Access your uploaded books and reading progress'
          },
          '/settings': {
            displayName: 'Settings',
            description: 'Manage your reading preferences and account settings'
          },
          '/stats': {
            displayName: 'Reading Stats',
            description: 'View your reading statistics and kanji progress'
          },
          '/admin': {
            displayName: 'Admin Panel',
            description: 'Administrative tools and system management'
          },
          '/support-development': {
            displayName: 'Supporter Tier',
            description: 'Access premium features and subscription management'
          }
        }
        
        // Find matching path info
        const matchedPath = Object.keys(pathInfo).find(key => path.startsWith(key))
        if (matchedPath) {
          setRedirectInfo({
            path: redirectUrl,
            ...pathInfo[matchedPath as keyof typeof pathInfo]
          })
        } else if (path.startsWith('/library/')) {
          // Special handling for specific book pages
          setRedirectInfo({
            path: redirectUrl,
            displayName: 'Your Book',
            description: 'Continue reading where you left off'
          })
        }
      } catch (error) {
        console.log('Could not parse redirect URL:', error)
      }
    }
  }, [searchParams])

  // Redirect if user is already logged in
  useEffect(() => {
    if (!isLoading && user) {
      // Check if there's a redirect URL to go back to
      const redirectUrl = localStorage.getItem('redirectAfterLogin')
      if (redirectUrl) {
        localStorage.removeItem('redirectAfterLogin')
        router.push(redirectUrl)
      } else {
        // Default redirect to library
        router.push('/library')
      }
    }
  }, [user, isLoading, router])

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
        <div className="text-center">
          <div className="text-lg font-medium">Loading...</div>
        </div>
      </div>
    )
  }

  // Don't show login page if user is already authenticated
  if (user) {
    return null // Will redirect in useEffect above
  }

  const handleLogin = async () => {
    setError(null)

    const trimmedUsername = username.trim()

    if (!trimmedUsername) {
      setError('Please enter a username')
      return
    }

    if (!isValidUsername(trimmedUsername)) {
      setError('Username must be 1-50 characters and contain only letters, numbers, underscores, and hyphens')
      return
    }

    // Store username in localStorage (will be picked up by AuthContext)
    localStorage.setItem('jreader_username', trimmedUsername)

    // Also set cookie for server-side middleware
    document.cookie = `jreader_username=${encodeURIComponent(trimmedUsername)}; path=/; max-age=${60 * 60 * 24 * 365}`; // 1 year

    // Trigger auth context to reload
    window.dispatchEvent(new Event('storage'))

    // Check if there's a redirect URL to go back to
    const redirectUrl = localStorage.getItem('redirectAfterLogin')
    if (redirectUrl) {
      localStorage.removeItem('redirectAfterLogin')
      router.push(redirectUrl)
    } else {
      // Default redirect to library
      router.push('/library')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin()
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BookOpen className="size-4" />
          </div>
          JReader
        </a>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Welcome to JReader</CardTitle>
            <CardDescription>
              Enter your username to start reading
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full"
                  autoFocus
                />
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>
              <Button onClick={handleLogin} className="w-full">
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="text-balance text-center text-xs text-muted-foreground">
          Self-hosted reading app for Japanese learners
        </div>
      </div>
    </div>
  )
} 