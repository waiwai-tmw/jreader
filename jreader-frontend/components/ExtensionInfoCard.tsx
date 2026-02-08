'use client'

import { ExternalLink } from "lucide-react"

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  HoverCardPortal,
} from "@/components/ui/hover-card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useExtension } from "@/contexts/ExtensionContext"
import { useMediaQuery } from "@/hooks/use-media-query"

interface ExtensionInfoCardProps {
  children: React.ReactNode;
}

function CardContent() {
  const { extensionStatus } = useExtension()

  const getDescription = () => {
    switch (true) {
      case extensionStatus.available === null:
        return "Checking extension status..."
      case !extensionStatus.available:
        return "The JReader extension is not installed. Install it to automatically sync your mined cards to Anki while you read."
      case extensionStatus.available && !extensionStatus.paired:
        return "The extension is installed but not yet authenticated. Open the extension and sign in with your JReader account to enable auto-sync."
      case extensionStatus.available && extensionStatus.paired:
        return "The extension is installed and authenticated. Cards will automatically sync to Anki as you mine them (when auto-sync is enabled)."
      default:
        return "The JReader extension helps you sync mined Japanese cards directly to Anki."
    }
  }

  const getDownloadLinks = () => {
    if (extensionStatus.available) return null

    return (
      <div className="mt-3 pt-3 border-t space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Install the extension:</p>
        <div className="space-y-1.5">
          <a
            href="https://chromewebstore.google.com/detail/jreader/YOUR_CHROME_ID"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-blue-500 hover:text-blue-600 hover:underline"
          >
            <span>Chrome Web Store</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://addons.mozilla.org/firefox/addon/jreader/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-blue-500 hover:text-blue-600 hover:underline"
          >
            <span>Firefox Add-ons</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://microsoftedge.microsoft.com/addons/detail/jreader/YOUR_EDGE_ID"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-blue-500 hover:text-blue-600 hover:underline"
          >
            <span>Edge Add-ons</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 text-sm">
      <h4 className="font-semibold">JReader Extension</h4>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {getDescription()}
      </p>
      {getDownloadLinks()}
    </div>
  );
}

export function ExtensionInfoCard({ children }: ExtensionInfoCardProps) {
  const isTouch = useMediaQuery("(hover: none), (pointer: coarse)");

  if (isTouch) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="inline-block">
            {children}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 z-[9999]">
          <CardContent />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent className="w-80 z-[9999]">
          <CardContent />
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}
