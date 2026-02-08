'use client'

import { DiscordLogoIcon } from "@radix-ui/react-icons"

import { signInWithDiscord } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'

export function LoginButton() {
  return (
    <Button 
      onClick={() => signInWithDiscord()}
      variant="outline"
      size="lg"
      className="w-full gap-2 hover:bg-[#5865F2] hover:text-white transition-colors"
    >
      <DiscordLogoIcon className="h-5 w-5" />
      Continue with Discord
    </Button>
  )
} 