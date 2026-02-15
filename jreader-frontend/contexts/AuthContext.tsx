'use client'

import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'

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

  const signIn = () => {
    router.push('/login')
  }

  const signOut = async () => {
    // Remove username from localStorage
    localStorage.removeItem('jreader_username')

    // Also clear the cookie
    document.cookie = 'jreader_username=; path=/; max-age=0'

    setUser(null)

    // Store current URL for potential redirect back after login
    const currentUrl = window.location.pathname + window.location.search;
    if (currentUrl !== '/login' && !currentUrl.startsWith('/auth')) {
      localStorage.setItem('redirectAfterLogin', currentUrl);
    }

    // Redirect to login page
    router.push('/login')
  }

  useEffect(() => {
    // Load user from localStorage
    const loadUser = () => {
      const username = localStorage.getItem('jreader_username')

      if (username) {
        setUser({
          id: username,
          name: username,
          avatar: '',
          isAdmin: false, // For now, no admin checking (can add later)
        })
      } else {
        setUser(null)
      }

      setIsLoading(false)
    }

    // Load initially
    loadUser()

    // Listen for storage events (for cross-tab sync and login trigger)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'jreader_username') {
        loadUser()
      }
    }

    // Also listen for custom storage events (triggered by login page)
    const handleCustomStorageChange = () => {
      loadUser()
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('storage', handleCustomStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('storage', handleCustomStorageChange)
    }
  }, [router])

  return (
    <AuthContext.Provider value={{ user, isLoading, isAdminLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
} 