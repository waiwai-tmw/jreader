'use client'

import { BookOpen, Home, PieChart, Search, LogIn, Info, Coffee, Pickaxe, LayoutDashboard } from "lucide-react"
import { useRouter } from 'next/navigation'

import { NavUser } from "./nav-user"

import { KanjiLegend } from '@/components/KanjiLegend'
import { ThemeToggleEink } from '@/components/theme-toggle-eink'
import { TierIndicator } from '@/components/TierIndicator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/hooks/useSubscription'


// Menu items (always visible or redirect to login)
const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    requiresAuth: true,
  },
  {
    title: "Dictionary",
    url: "/dictionary",
    icon: Search,
  },
  {
    title: "Library",
    url: "/library",
    icon: BookOpen,
  },
  {
    title: "Stats",
    url: "/stats",
    icon: PieChart,
    requiresAuth: true, // Mark Stats as requiring authentication for access
  },
  {
    title: "Mining",
    url: "/mining",
    icon: Pickaxe,
    requiresAuth: true, // Mining history requires authentication
  },
  {
    title: "Support Development",
    url: "/support-development",
    icon: Coffee,
  },
  {
    title: "About",
    url: "/about",
    icon: Info,
  },
]

export function AppSidebar() {
  const { user, isLoading, signIn, signOut } = useAuth()
  const router = useRouter()
  const { data: subscriptionData } = useSubscription()

  const getTierTooltip = () => {
    const tier = subscriptionData?.tier || 0
    switch (tier) {
      case 0:
        return 'Community'
      case 1:
        return 'Supporter'
      default:
        return 'Community'
    }
  }

  // Filter items based on authentication requirements
  const visibleItems = items.filter(item => {
    // All items are either always visible or redirect to login
    return true
  })

  const handleItemClick = (item: any, e: React.MouseEvent) => {
    if (item.requiresAuth && !user) {
      e.preventDefault()
      // Store the intended destination for redirect after login
      localStorage.setItem('redirectAfterLogin', item.url)
      signIn()
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            <a href="/" className="hover:opacity-80 transition-opacity">JReader</a>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url} onClick={(e) => handleItemClick(item, e)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <KanjiLegend />
        <div className="flex items-center justify-center p-2 group-data-[collapsible=icon]:p-1">
          <div className="group-data-[collapsible=icon]:scale-75">
            <ThemeToggleEink />
          </div>
        </div>
        {/* Tier indicator for collapsed state */}
        {user && (
          <SidebarMenu>
            <SidebarMenuItem className="group-data-[collapsible=icon]:block hidden">
              <SidebarMenuButton tooltip={getTierTooltip()} className="group-data-[collapsible=icon]:justify-center">
                <TierIndicator variant="compact" showLabel={false} />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        {isLoading ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-[80px]" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : user ? (
          <NavUser user={user} onSignOut={signOut} />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={signIn}>
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
