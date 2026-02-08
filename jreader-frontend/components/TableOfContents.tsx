'use client'

import { ChevronDown } from "lucide-react"
import * as React from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { createClient } from '@/utils/supabase/client'

interface TableOfContentsProps {
  onNavigate: (pageNumber: number) => void
  bookTitle: string
  supabaseUploadId: string
  tocEntries?: Array<{
    label: string
    page_number: number
    play_order: number
  }>
}

export function TableOfContents({ onNavigate, bookTitle, supabaseUploadId, tocEntries = [] }: TableOfContentsProps) {
  const [open, setOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [entries, setEntries] = React.useState<Array<{
    label: string
    page_number: number
    play_order: number
  }>>([])

  // Use shared TOC data if provided, otherwise fetch independently
  React.useEffect(() => {
    if (tocEntries && tocEntries.length > 0) {
      // Use shared TOC data from parent component
      setEntries(tocEntries);
      setIsLoading(false);
    } else {
      // Fallback: fetch TOC data independently (for backward compatibility)
      async function fetchToc() {
        if (!supabaseUploadId) {
          console.log('No supabaseUploadId provided');
          return;
        }

        // Check cache first
        const cacheKey = `toc-${supabaseUploadId}`;
        const cachedToc = localStorage.getItem(cacheKey);
        
        if (cachedToc) {
          try {
            const parsed = JSON.parse(cachedToc);
            console.log('Using cached TOC data for dropdown:', supabaseUploadId);
            setEntries(parsed);
            setIsLoading(false);
            return;
          } catch (e) {
            console.log('Failed to parse cached TOC, fetching fresh data');
          }
        }

        console.log('Fetching TOC for dropdown:', supabaseUploadId);
        const supabase = createClient();
        const { data, error } = await supabase
          .from('Table of Contents')
          .select('label, page_number, play_order')
          .eq('upload_id', supabaseUploadId)
          .order('play_order');

        if (error) {
          console.error('Error fetching TOC:', error);
          return;
        }

        console.log('TOC entries fetched for dropdown:', data);
        setEntries(data || []);
        setIsLoading(false);
        
        // Cache the data
        if (data) {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        }
      }

      setIsLoading(true);
      fetchToc();
    }
  }, [supabaseUploadId, tocEntries]);

  const handleNavigate = (pageNumber: number) => {
    onNavigate(pageNumber)
    setOpen(false)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="flex h-8 items-center gap-2 rounded-md px-3 font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent/0 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-accent/50 min-w-0">
        {isLoading ? (
          <Skeleton className="h-4 w-[200px]" />
        ) : (
          <span className="truncate flex-1 min-w-0 text-ellipsis overflow-hidden">{bookTitle}</span>
        )}
        <ChevronDown 
          className={cn(
            "h-5 w-5 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="center" 
        className="w-[400px] max-w-[90vw] p-0"
        sideOffset={8}
      >
        <ScrollArea className="h-[400px]">
          <div className="p-4">
            <h4 className="mb-4 text-sm font-medium text-muted-foreground">目次</h4>
            {entries.map((entry, index) => (
              <DropdownMenuItem
                key={entry.play_order}
                onSelect={() => handleNavigate(entry.page_number)}
                className="rounded-md px-2 py-2 text-sm hover:bg-muted focus:bg-muted cursor-pointer"
              >
                <div className="flex items-start gap-3 w-full">
                  <span className="text-xs text-muted-foreground font-mono min-w-[2.5rem] flex-shrink-0">
                    {entry.page_number === 0 ? 'Cover' : entry.page_number}
                  </span>
                  <span className="flex-1 text-sm leading-relaxed break-words">{entry.label}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 