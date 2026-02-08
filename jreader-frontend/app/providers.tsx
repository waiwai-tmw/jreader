'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import { ThemeProvider } from '@/components/theme-provider'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: false,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        themes={["light", "dark", "solarized-light", "solarized-dark", "asuka", "system"]}
        value={{
          light: "light",
          dark: "dark",
          "solarized-light": "solarized-light",
          "solarized-dark": "solarized-dark",
          "asuka": "asuka",
          system: "system"
        }}
      >
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )
} 