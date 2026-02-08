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
import { useMediaQuery } from "@/hooks/use-media-query"

interface BookmarkInfoCardProps {
  isDisabled: boolean;
  children: React.ReactNode;
}

function CardContent() {
  return (
    <div className="space-y-2 max-w-xs">
      <h4 className="text-sm font-semibold">Bookmarks</h4>
      <p className="text-sm text-muted-foreground">
        Sign in to save your reading position across devices. Your bookmarks will be automatically saved as you read.
      </p>
    </div>
  );
}

export function BookmarkInfoCard({ isDisabled, children }: BookmarkInfoCardProps) {
  const isTouch = useMediaQuery("(hover: none), (pointer: coarse)");

  if (!isDisabled) {
    // If not disabled, just render children without any card
    return <>{children}</>;
  }

  if (isTouch) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="inline-block p-0 h-auto bg-transparent border-none hover:bg-transparent">
            {children}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 z-[9999]">
          <CardContent />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger asChild>
        <button type="button" className="inline-block p-0 h-auto bg-transparent border-none hover:bg-transparent">
          {children}
        </button>
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent className="w-64 z-[9999]">
          <CardContent />
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}
