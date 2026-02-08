'use client'

import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState, useRef } from 'react'

import { checkAdminStatus, clearAdminCache } from '@/utils/api'
import { createClient } from '@/utils/supabase/client'
import { isFakeAuthEnabled, FAKE_TEST_USER } from '@/lib/auth/fake-adapter'

// Safe short hash for debug logs to verify tokens are different
async function hashToken(token: string): Promise<string> {
  if (!token) return 'none';
  const data = new TextEncoder().encode(token);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .slice(0, 6)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

type UserData = {
  id: string;
  name: string;
  avatar: string;
  isAdmin: boolean;
}

type AuthContextType = {
  user: UserData | null;
  isLoading: boolean;
  isAdminLoading: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAdminLoading, setIsAdminLoading] = useState(false)
  const isCheckingAdminRef = useRef(false) // Use a ref to prevent race conditions

  const signIn = () => {
    router.push('/login')
  }

  const signOut = async () => {
    const supabase = createClient()
    // Use local scope to avoid affecting extension session
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (!error) {
      setUser(null)
      clearAdminCache() // Clear admin cache on logout
      
      // Store current URL for potential redirect back after login
      const currentUrl = window.location.pathname + window.location.search;
      if (currentUrl !== '/login' && !currentUrl.startsWith('/auth')) {
        localStorage.setItem('redirectAfterLogin', currentUrl);
      }
      
      // Redirect to login page instead of refreshing
      router.push('/login')
    }
  }

  useEffect(() => {
    // Fake auth mode for E2E tests
    if (isFakeAuthEnabled()) {
      setUser({
        id: FAKE_TEST_USER.id,
        name: FAKE_TEST_USER.global_name,
        avatar: FAKE_TEST_USER.avatar_url,
        isAdmin: false,
      })
      setIsLoading(false)
      return
    }

    // Listen for auth state changes - this will fire immediately with current session
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Debug: Log token hash to verify it's different from extension
          if (session.refresh_token) {
            hashToken(session.refresh_token).then(hash => {
              console.log('🔐 WEB refresh token hash:', hash);
            });
          }

          // Set user immediately with admin status as false initially
          setUser({
            id: session.user.id,
            name: session.user.user_metadata.custom_claims.global_name,
            avatar: session.user.user_metadata.avatar_url,
            isAdmin: false // Start with false, will update later
          })

          // Check admin status separately (non-blocking) - only if not already checking
          if (!isCheckingAdminRef.current) {
            isCheckingAdminRef.current = true
            setIsAdminLoading(true)
            checkAdminStatus().then(isAdmin => {
              setUser(prevUser => prevUser ? { ...prevUser, isAdmin } : null)
              setIsAdminLoading(false)
              isCheckingAdminRef.current = false
            }).catch(error => {
              console.error('Error checking admin status:', error)
              // Keep admin as false if check fails
              setIsAdminLoading(false)
              isCheckingAdminRef.current = false
            })
          }

          // Check for redirect URL after successful login
          const redirectUrl = localStorage.getItem('redirectAfterLogin')
          if (redirectUrl) {
            localStorage.removeItem('redirectAfterLogin')
            router.push(redirectUrl)
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setIsAdminLoading(false)
          isCheckingAdminRef.current = false // Reset admin checking flag
          clearAdminCache() // Clear admin cache on sign out

          // Handle cross-tab logout gracefully
          // Only redirect to login if we're not already on login page
          if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/auth')) {
            // Store current URL for potential redirect back after login
            const currentUrl = window.location.pathname + window.location.search;
            localStorage.setItem('redirectAfterLogin', currentUrl);

            // Use router.push instead of window.location to avoid full page reload
            router.push('/login');
          }
        }

        // Mark loading as complete after handling the auth state
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdminLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
} 