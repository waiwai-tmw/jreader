"use client"

import {
  ChevronsUpDown,
  LogOut,
  Coffee,
  Shield,
  Settings,
} from "lucide-react"

import { TierIndicator } from "./TierIndicator"


import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useSubscription } from "@/hooks/useSubscription"

interface NavUserProps {
  user: {
    name: string
    avatar: string
    isAdmin: boolean
  }
  onSignOut?: () => void
}

export function NavUser({ user, onSignOut }: NavUserProps) {
  const { isMobile } = useSidebar()
  const { data: subscriptionData } = useSubscription()

  const getUpgradeAction = () => {
    const tier = subscriptionData?.tier || 0

    if (tier === 0) {
      return {
        label: 'Become a Supporter',
        icon: Coffee,
        href: '/support-development'
      }
    } else {
      return null // No upgrade needed for supporter tier
    }
  }

  const upgradeAction = getUpgradeAction()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <TierIndicator variant="compact" className="mt-0.5" />
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Account
            </DropdownMenuLabel>
            {upgradeAction && (
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <a href={upgradeAction.href}>
                    <upgradeAction.icon className="mr-2 size-4" />
                    {upgradeAction.label}
                  </a>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <a href="/settings">
                  <Settings />
                  Settings
                </a>
              </DropdownMenuItem>
              {user.isAdmin && (
                <DropdownMenuItem asChild>
                  <a href="/admin">
                    <Shield />
                    Admin
                  </a>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut}>
              <LogOut className="mr-2 size-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
