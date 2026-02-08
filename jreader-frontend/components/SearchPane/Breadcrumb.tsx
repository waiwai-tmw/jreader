import { ChevronRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

interface SearchStackEntry {
  query: string;
  firstTerm?: string;
  scrollY?: number;
}

interface BreadcrumbProps {
  stackPosition: string;
  searchStack: Array<{
    query: string;
    firstTerm?: string;
    scrollY?: number;
  }>;
  onBack?: (steps?: number) => void;
  onNavigate?: (steps?: number) => void;
  isLoading?: boolean;
}

export function Breadcrumb({ stackPosition, searchStack, onBack, onNavigate, isLoading }: BreadcrumbProps) {
  const [current] = stackPosition.split('/').map(Number);
  
  const handleClick = (index: number) => {
    console.log('🔄(1) Clicked on index:', index)
    const stepsBack = searchStack.length - (index + 1);
    if (stepsBack > 0) {
      onBack?.(stepsBack);
      
      // Wait for content to render then restore scroll
      setTimeout(() => {
        const scrollContainer = document.querySelector('.overflow-y-auto')
        const item = searchStack[index]
        console.log('Search stack item:', item)
        if (scrollContainer && item.scrollY) {
          scrollContainer.scrollTo(0, item.scrollY)
        }
      }, 100)
    }
  };
  
  return (
            <div className="flex flex-wrap items-center gap-2 mb-2 text-sm text-muted-foreground" data-testid="breadcrumb-navigation">
      {searchStack.map((entry, i) => (
        <div key={i} className="flex items-center flex-nowrap">
          {i > 0 && <ChevronRight className="h-4 w-4 mx-1 flex-shrink-0" />}
          <button
            className={`whitespace-nowrap hover:underline ${i === searchStack.length - 1 ? 'font-medium' : 'opacity-50'}`}
            onClick={() => handleClick(i)}
          >
            {entry.firstTerm ? entry.firstTerm : <Skeleton className="h-4 w-12" />}
          </button>
        </div>
      ))}
    </div>
  );
} 