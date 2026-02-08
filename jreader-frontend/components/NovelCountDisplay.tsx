'use client';

import { BookOpen, TrendingUp } from "lucide-react";
import { useEffect, useState } from 'react';

import { Card, CardContent } from "@/components/ui/card";

interface NovelCountDisplayProps {
  className?: string;
}

export default function NovelCountDisplay({ className }: NovelCountDisplayProps) {
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNovelCount = async () => {
      try {
        const response = await fetch('/api/webnovels/count');
        if (!response.ok) {
          throw new Error('Failed to fetch novel count');
        }
        const data = await response.json();
        setTotalCount(data.totalCount);
      } catch (err) {
        console.error('Error fetching novel count:', err);
        setError('Failed to load novel count');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNovelCount();
  }, []);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="h-4 w-20 bg-muted animate-pulse rounded"></div>
              <div className="h-3 w-32 bg-muted animate-pulse rounded mt-1"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return null; // Fail silently to not break the UI
  }

  const formatCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-primary">
                {totalCount !== null ? formatCount(totalCount) : '0'}
              </span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              Novels instantly available
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
