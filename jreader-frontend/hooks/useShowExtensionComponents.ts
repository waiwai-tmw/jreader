'use client'

import { useEffect, useState } from 'react'

import { safeLocation } from '@/utils/safeWindow'

export function useShowExtensionComponents(user: any, isSafari: boolean) {
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    const checkPath = () => {
      const pathname = safeLocation.pathname
      const isValidPath = pathname.startsWith('/dictionary') || pathname === '/mining'|| (pathname.startsWith('/library/') && pathname !== '/library/')
      setShouldShow(!isSafari && isValidPath)
    }

    // Initial check
    checkPath()

    // Listen for pathname changes
    const handlePopState = () => {
      checkPath()
    }
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [user, isSafari])

  return shouldShow
}
