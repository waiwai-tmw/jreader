'use client'

import { safeLocation } from './safeWindow'

/**
 * Check if the current path is one where extension components and toasts should be shown
 */
export function isExtensionEnabledPath(): boolean {
  const pathname = safeLocation.pathname
  const res = pathname === '/dictionary' || (pathname.startsWith('/library') && pathname !== '/library')
  console.log("Pathname is " + pathname + " and res is " + res)
  return res

}

/**
 * Check if we should show extension-related toasts on the current path
 * @param pathname Optional pathname to check (defaults to current path)
 */
export function shouldShowExtensionToasts(pathname?: string): boolean {
  const currentPath = pathname || safeLocation.pathname
  return currentPath !== '/ext-auth' && isExtensionEnabledPath()
}
