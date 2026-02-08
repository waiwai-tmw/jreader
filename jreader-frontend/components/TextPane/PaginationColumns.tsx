import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationColumnsProps {
  onScrollLeft: () => void;
  onScrollRight: () => void;
  className?: string;
}

export const PaginationColumns = ({ onScrollLeft, onScrollRight, className = "" }: PaginationColumnsProps) => {
  return (
    <>
      <div 
        className={`absolute left-0 top-0 bottom-0 w-6 transition-colors z-40 flex items-center justify-center cursor-pointer group ${className}`}
        onClick={onScrollLeft}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-muted/40 via-muted/20 to-transparent group-hover:from-muted/60 group-hover:via-muted/30" />
        <div className="relative z-10 bg-accent/90 border border-accent-foreground/30 rounded-sm p-0.5 shadow-md group-hover:bg-accent group-hover:border-accent-foreground/50 transition-colors">
          <ChevronLeft className="w-3 h-3 text-accent-foreground" />
        </div>
      </div>
      <div 
        className={`absolute right-0 top-0 bottom-0 w-6 transition-colors z-40 flex items-center justify-center cursor-pointer group ${className}`}
        onClick={onScrollRight}
      >
        <div className="absolute inset-0 bg-gradient-to-l from-background/90 via-background/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-l from-muted/40 via-muted/20 to-transparent group-hover:from-muted/60 group-hover:via-muted/30" />
        <div className="relative z-10 bg-accent/90 border border-accent-foreground/30 rounded-sm p-0.5 shadow-md group-hover:bg-accent group-hover:border-accent-foreground/50 transition-colors">
          <ChevronRight className="w-3 h-3 text-accent-foreground" />
        </div>
      </div>
    </>
  );
};
