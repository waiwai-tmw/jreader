'use client'

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState, useEffect } from 'react'

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useDeviceDetect } from '@/hooks/useDeviceDetect'
import { cn } from "@/lib/utils"

interface TocEntry {
  label: string;
  page_number: number;
  play_order: number;
}

interface PageFooterProps {
  currentPage: number;
  totalPages: number;
  tocEntries?: TocEntry[];
}

export function PageFooter({ currentPage, totalPages, tocEntries = [] }: PageFooterProps) {
  const isMobile = useDeviceDetect();
  
  // Check if it's a small screen (phone) vs larger screen (tablet/desktop)
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 768;
  
  // State to track which ellipsis is expanded
  const [expandedEllipsis, setExpandedEllipsis] = useState<'left' | 'right' | null>(null);
  
  // Auto-collapse timer
  useEffect(() => {
    if (expandedEllipsis) {
      const timer = setTimeout(() => {
        setExpandedEllipsis(null);
      }, 10000); // 10 seconds
      
      return () => clearTimeout(timer);
    }
  }, [expandedEllipsis]);
  
  // Find the chapter title for a given page number
  const getChapterForPage = (pageNum: number): string | null => {
    if (!tocEntries || tocEntries.length === 0) return null;
    
    // Find the chapter that starts at or before this page
    let chapter = null;
    for (let i = tocEntries.length - 1; i >= 0; i--) {
      if (tocEntries[i].page_number <= pageNum) {
        chapter = tocEntries[i];
        break;
      }
    }
    
    return chapter?.label || null;
  };
  
  const getPageNumbers = (current: number, total: number) => {
    // Show fewer page numbers on small screens to prevent overflow
    const delta = isSmallScreen ? 1 : 4;
    const range: (number | 'ellipsis')[] = [];
    
    for (let i = 0; i < total; i++) {
      if (
        i === 0 ||
        i === total - 1 ||
        (i >= current - delta && i <= current + delta) ||
        (expandedEllipsis === 'left' && i < current - delta) ||
        (expandedEllipsis === 'right' && i > current + delta)
      ) {
        range.push(i);
      } else if (
        i === current - delta - 1 ||
        i === current + delta + 1
      ) {
        range.push('ellipsis');
      }
    }
    
    return range.filter((value, index, array) => 
      value === 'ellipsis' ? array[index - 1] !== 'ellipsis' : true
    );
  };

  const handleNavigate = (page: number) => {
    const event = new CustomEvent('booknavigate', {
      detail: { page }
    });
    window.dispatchEvent(event);
  };

  const getPageDisplay = (pageNum: number) => {
    if (pageNum === 0) return 'Cover';
    return pageNum;
  };

  const handleEllipsisClick = (side: 'left' | 'right') => {
    setExpandedEllipsis(expandedEllipsis === side ? null : side);
  };

  return (
    <TooltipProvider>
      <footer className={cn(
        "absolute bottom-0 left-0 right-0 bg-background border-t z-10",
        // On mobile, account for the drawer and ensure proper positioning
        isMobile ? "bottom-0" : "bottom-0"
      )}>
        <div className={cn(
          "w-full",
          isSmallScreen && expandedEllipsis && "overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        )}>
          <Pagination className="mx-0 min-w-max">
            <PaginationContent className="justify-center px-4 gap-1">
            <PaginationItem>
              <button
                onClick={() => handleNavigate(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
                className="flex items-center gap-1 px-2 py-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 text-xs"
              >
                <ChevronLeft className="h-3 w-3" />
                {isMobile ? 'N' : 'Next'}
              </button>
            </PaginationItem>

            {getPageNumbers(currentPage, totalPages)
              .reverse()
              .map((pageNum, index) => (
                <PaginationItem key={`${pageNum}-${index}`}>
                  {pageNum === 'ellipsis' ? (
                    <button
                      onClick={() => {
                        // Determine if this is left or right ellipsis based on the page numbers around it
                        const pageNumbers = getPageNumbers(currentPage, totalPages).reverse();
                        const ellipsisIndex = pageNumbers.findIndex((item, idx) => 
                          item === 'ellipsis' && idx === index
                        );
                        
                        // Determine if this is left or right ellipsis based on the page numbers around it
                        const beforeEllipsis = pageNumbers.slice(0, ellipsisIndex).filter(item => typeof item === 'number');
                        const afterEllipsis = pageNumbers.slice(ellipsisIndex + 1).filter(item => typeof item === 'number');
                        
                        // Check if this ellipsis represents pages before the current range (left) or after (right)
                        const currentRangeStart = currentPage - (isSmallScreen ? 1 : 4);
                        const currentRangeEnd = currentPage + (isSmallScreen ? 1 : 4);
                        
                        // If the pages after this ellipsis are in the current range, it's a right ellipsis (expands left/later pages)
                        // If the pages before this ellipsis are in the current range, it's a left ellipsis (expands right/earlier pages)
                        const hasCurrentRangeAfter = afterEllipsis.some(page => page >= currentRangeStart && page <= currentRangeEnd);
                        const isLeftEllipsis = !hasCurrentRangeAfter; // Flip for RTL reading
                        
                        handleEllipsisClick(isLeftEllipsis ? 'left' : 'right');
                      }}
                      className="flex h-7 w-7 items-center justify-center hover:bg-accent hover:text-accent-foreground rounded cursor-pointer transition-colors"
                      title="Click to show more pages"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="19" cy="12" r="1"></circle>
                        <circle cx="5" cy="12" r="1"></circle>
                      </svg>
                    </button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PaginationLink
                          onClick={() => handleNavigate(pageNum)}
                          isActive={pageNum === currentPage}
                          className={cn(
                            "cursor-pointer",
                            "h-7 text-xs",
                            "px-2",
                            "min-w-[1.75rem]",
                            pageNum === 0 && "min-w-[3rem]",
                            "hover:bg-accent hover:text-accent-foreground",
                            pageNum === currentPage && "bg-accent text-accent-foreground"
                          )}
                        >
                          {pageNum === 0 ? 'Cover' : pageNum}
                        </PaginationLink>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <div className="space-y-1">
                          <div className="font-semibold">{pageNum === 0 ? 'Cover' : `Chapter ${pageNum}`}</div>
                          {getChapterForPage(pageNum) && (
                            <div className="text-xs opacity-80">
                              {getChapterForPage(pageNum)}
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </PaginationItem>
              ))}

            <PaginationItem>
              <button
                onClick={() => handleNavigate(currentPage - 1)}
                disabled={currentPage <= 0}
                className="flex items-center gap-1 px-2 py-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 text-xs"
              >
                {isMobile ? 'P' : 'Previous'}
                <ChevronRight className="h-3 w-3" />
              </button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        </div>
      </footer>
    </TooltipProvider>
  );
} 