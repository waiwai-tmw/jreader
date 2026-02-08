'use client'

import { RefreshCw, Eye, EyeOff, Trash2, BarChart3 } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RenderTracker } from '@/utils/renderTracker';
import type { RenderInfo } from '@/utils/renderTracker';

interface RenderAnalyzerProps {
  componentName?: string;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
}

export function RenderAnalyzer({ 
  componentName = 'SearchPane', 
  isVisible = true,
  onToggleVisibility 
}: RenderAnalyzerProps) {
  const [stats, setStats] = useState<Array<{ componentName: string; totalRenders: number; recentRenders: RenderInfo[] }>>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedComponent, setSelectedComponent] = useState(componentName);

  const refreshStats = useCallback(() => {
    const currentStats = RenderTracker.getAllStats();
    setStats(currentStats);
  }, []);

  useEffect(() => {
    refreshStats();
    
    if (autoRefresh) {
      const interval = setInterval(refreshStats, 1000);
      return () => clearInterval(interval);
    }
  }, [refreshStats, autoRefresh]);

  const resetStats = () => {
    RenderTracker.reset();
    refreshStats();
  };

  const getComponentStats = () => {
    return stats.find(s => s.componentName === selectedComponent);
  };

  const componentStats = getComponentStats();

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={onToggleVisibility}
          size="sm"
          variant="outline"
          className="bg-background/80 backdrop-blur-sm"
        >
          <Eye className="w-4 h-4 mr-2" />
          Show Render Analyzer
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96">
      <Card className="bg-background/95 backdrop-blur-sm border-border/50 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Render Analyzer
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                onClick={onToggleVisibility}
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
              >
                <EyeOff className="w-3 h-3" />
              </Button>
              <Button
                onClick={resetStats}
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                title="Reset stats"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <Tabs value={selectedComponent} onValueChange={setSelectedComponent}>
            <TabsList className="grid w-full grid-cols-2">
              {stats.map(stat => (
                <TabsTrigger key={stat.componentName} value={stat.componentName} className="text-xs">
                  {stat.componentName}
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {stat.totalRenders}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            
            {stats.map(stat => (
              <TabsContent key={stat.componentName} value={stat.componentName} className="mt-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      Total Renders: {stat.totalRenders}
                    </div>
                    <Button
                      onClick={refreshStats}
                      size="sm"
                      variant="outline"
                      className="h-6 px-2"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  {stat.recentRenders.length > 1 && (
                    <div className="text-xs text-muted-foreground">
                      Avg time between renders: {
                        (stat.recentRenders.slice(1).reduce((acc, render, i) => {
                          return acc + (render.timestamp - stat.recentRenders[i].timestamp);
                        }, 0) / (stat.recentRenders.length - 1)).toFixed(2)
                      }ms
                    </div>
                  )}
                  
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {stat.recentRenders.slice().reverse().map((render, index) => (
                        <div key={render.count} className="text-xs border rounded p-2 bg-muted/50">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">#{render.count}</span>
                            <span className="text-muted-foreground">
                              {new Date(render.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          
                          {render.changedProps.length > 0 ? (
                            <div className="space-y-1">
                              <div className="text-muted-foreground">Changed props:</div>
                              {render.changedProps.map(prop => (
                                <Badge key={prop} variant="outline" className="text-xs mr-1 mb-1">
                                  {prop}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <div className="text-muted-foreground">No prop changes</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>
            ))}
          </Tabs>
          
          <div className="mt-3 pt-3 border-t">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-3 h-3"
              />
              Auto refresh
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Hook to easily add render tracking to any component
export function useRenderAnalyzer(componentName: string, enabled: boolean = false) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (enabled && typeof window !== 'undefined') {
      // Add global function to toggle analyzer
      (window as any).toggleRenderAnalyzer = () => setIsVisible(prev => !prev);
      
      // Add keyboard shortcut (Ctrl+Shift+R)
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
          e.preventDefault();
          setIsVisible(prev => !prev);
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        delete (window as any).toggleRenderAnalyzer;
      };
    }
  }, [enabled]);

  return {
    isVisible,
    setIsVisible,
    RenderAnalyzerComponent: enabled ? () => (
      <RenderAnalyzer 
        componentName={componentName}
        isVisible={isVisible}
        onToggleVisibility={() => setIsVisible(prev => !prev)}
      />
    ) : () => null
  };
}
