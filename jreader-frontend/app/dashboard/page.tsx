'use client'

import { AnnouncementBanner } from "@/components/AnnouncementBanner"
import { BaseHeader } from "@/components/BaseHeader"
import WelcomeScreen from '@/components/WelcomeScreen'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function Dashboard() {
  usePageTitle('Home - JReader');
  return (
    <div className="absolute inset-0 flex flex-col">
      <BaseHeader />
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto mb-6">
            <AnnouncementBanner />
          </div>
          <div className="max-w-2xl mx-auto">
            <WelcomeScreen />
          </div>
        </div>
      </div>
    </div>
  );
}


