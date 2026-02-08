'use client'

import { Moon, Sun, Laptop, Palette } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function ThemeSwitcher() {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const icon = useMemo(() => {
    if (!mounted) return <Sun className="h-4 w-4" />
    const effective = theme === 'system' ? systemTheme : theme
    if (effective === 'dark') return <Moon className="h-4 w-4" />
    return <Sun className="h-4 w-4" />
  }, [mounted, theme, systemTheme])

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Toggle theme">
          {icon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Laptop className="mr-2 h-4 w-4" /> System
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
          <Palette className="h-3.5 w-3.5" /> More
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('solarized-light')}>
          Solarized Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('solarized-dark')}>
          Solarized Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('asuka')}>
          Asuka
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


