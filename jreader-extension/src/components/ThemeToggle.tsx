import { Moon, Sun, Monitor, Check } from 'lucide-react';
import * as React from 'react';

import { Button } from './ui/button';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({
  className = ''
}: ThemeToggleProps): React.JSX.Element {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
        <Button
          variant={theme === 'light' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleThemeChange('light')}
          className="h-8 w-8 p-0"
        >
          <Sun className="h-4 w-4" />
          <span className="sr-only">Light theme</span>
        </Button>
        
        <Button
          variant={theme === 'dark' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleThemeChange('dark')}
          className="h-8 w-8 p-0"
        >
          <Moon className="h-4 w-4" />
          <span className="sr-only">Dark theme</span>
        </Button>
        
        <Button
          variant={theme === 'system' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleThemeChange('system')}
          className="h-8 w-8 p-0"
        >
          <Monitor className="h-4 w-4" />
          <span className="sr-only">System theme</span>
        </Button>
      </div>
    </div>
  );
}

// Alternative dropdown version for more compact display
export function ThemeToggleDropdown({ className = '' }: { className?: string }): React.JSX.Element {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
      >
        <Sun className="h-4 w-4 scale-100 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute h-4 w-4 scale-0 transition-all dark:scale-100 dark:rotate-0" />
        <span className="sr-only">Toggle theme</span>
      </Button>
      
      {/* Simple dropdown menu */}
      <div className="absolute right-0 top-9 z-50 min-w-[140px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
        <button
          onClick={() => handleThemeChange('light')}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          <Sun className="h-4 w-4" />
          Light
          {theme === 'light' && <Check className="ml-auto h-4 w-4" />}
        </button>
        <button
          onClick={() => handleThemeChange('dark')}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          <Moon className="h-4 w-4" />
          Dark
          {theme === 'dark' && <Check className="ml-auto h-4 w-4" />}
        </button>
        <button
          onClick={() => handleThemeChange('system')}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          <Monitor className="h-4 w-4" />
          System
          {theme === 'system' && <Check className="ml-auto h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
