'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { usePageTitle } from '@/hooks/usePageTitle'
import { isValidInternalUrl } from '@/utils/urlValidation'

export default function RedirectAfterLogin() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const next = searchParams.get('next') || '/'
  usePageTitle('Redirecting - JReader');

  useEffect(() => {
    // Check if there's a stored redirect URL in localStorage (from AppSidebar)
    const storedRedirectUrl = localStorage.getItem('redirectAfterLogin')
    
    if (storedRedirectUrl && isValidInternalUrl(storedRedirectUrl)) {
      // Clear the stored URL
      localStorage.removeItem('redirectAfterLogin')
      // Use router.push instead of window.location.href to preserve session
      router.push(storedRedirectUrl)
    } else {
      // Check if there's a stored dictionary URL in sessionStorage (legacy)
      const storedDictionaryUrl = sessionStorage.getItem('dictionaryRedirectUrl')
      
      if (storedDictionaryUrl && isValidInternalUrl(storedDictionaryUrl)) {
        // Clear the stored URL
        sessionStorage.removeItem('dictionaryRedirectUrl')
        // Use router.push instead of window.location.href to preserve session
        router.push(storedDictionaryUrl)
      } else {
        // No stored URL or invalid URL, redirect to the default next URL
        router.push(isValidInternalUrl(next) ? next : '/')
      }
    }
  }, [next, router])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="text-center">
        <div className="text-lg font-medium">Logging you in...</div>
        <div className="text-sm text-muted-foreground">Please wait while we redirect you.</div>
      </div>
    </div>
  )
}
