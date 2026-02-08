'use client'

import { Search, List, BookOpen, Settings, Bug, Grid } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react'

import type { VerticalMenuProps } from '@/types'

export default function VerticalMenu({ activePane, onPaneChange }: VerticalMenuProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes from other sources (like Esc key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className="flex flex-col gap-1 p-1 border-l landscape:border-l portrait:border-t border-border">
      <button
        onClick={() => onPaneChange(activePane === 'dictionary' ? 'none' : 'dictionary')}
        className={`p-1.5 rounded ${activePane === 'dictionary' ? 'bg-muted' : ''}`}
        title="Dictionary"
      >
        <Search className="w-5 h-5" />
      </button>
      
      <button
        onClick={() => onPaneChange(activePane === 'toc' ? 'none' : 'toc')}
        className={`p-1.5 rounded ${activePane === 'toc' ? 'bg-muted' : ''}`}
        title="Table of Contents"
      >
        <List className="w-5 h-5" />
      </button>
      
      <button
        onClick={() => onPaneChange(activePane === 'library' ? 'none' : 'library')}
        className={`p-1.5 rounded ${activePane === 'library' ? 'bg-muted' : ''}`}
        title="Library"
      >
        <BookOpen className="w-5 h-5" />
      </button>
      
      <button
        onClick={() => onPaneChange(activePane === 'settings' ? 'none' : 'settings')}
        className={`p-1.5 rounded ${activePane === 'settings' ? 'bg-muted' : ''}`}
        title="Settings"
      >
        <Settings className="w-5 h-5" />
      </button>
      
      <button
        onClick={() => onPaneChange(activePane === 'debug' ? 'none' : 'debug')}
        className={`p-1.5 rounded ${activePane === 'debug' ? 'bg-muted' : ''}`}
        title="Debug"
      >
        <Bug className="w-5 h-5" />
      </button>
      
      <button
        onClick={() => onPaneChange(activePane === 'kanjiGrid' ? 'none' : 'kanjiGrid')}
        className={`p-1.5 rounded ${activePane === 'kanjiGrid' ? 'bg-muted' : ''}`}
        title="Kanji Grid"
      >
        <Grid className="w-5 h-5" />
      </button>
      
      <div className="flex-1" />
      
      <button
        onClick={toggleFullscreen}
        className="p-1.5 rounded hover:bg-muted"
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      >
          {isFullscreen ? '⬆️' : '⬇️'}
        </button>
    </div>
  )
} 