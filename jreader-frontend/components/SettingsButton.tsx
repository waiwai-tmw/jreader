'use client'

import { Settings } from "lucide-react"

import { ThemeToggleEink } from '@/components/theme-toggle-eink'
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useEinkMode } from '@/contexts/EinkModeContext'
import { useSettings } from '@/contexts/SettingsContext'

export function SettingsButton() {
  const { fontSize, verticalMargin, updateSetting } = useSettings();
  const { isEinkMode, toggleEinkMode } = useEinkMode();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Font Size: {fontSize}x
            </label>
            <Slider
              defaultValue={[fontSize]}
              value={[fontSize]}
              onValueChange={([value]) => updateSetting('fontSize', value)}
              min={0.5}
              max={2.0}
              step={0.1}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Vertical Margin: {verticalMargin}vh
            </label>
            <Slider
              defaultValue={[verticalMargin]}
              value={[verticalMargin]}
              onValueChange={([value]) => updateSetting('verticalMargin', value)}
              min={0.5}
              max={5}
              step={0.5}
              className="w-full"
            />
          </div>
          <div className="space-y-4">
          
          <div className="pt-2 border-t">
            <label className="flex items-center justify-between text-sm font-medium mb-2">
              <span>Theme</span>
              <ThemeToggleEink />
            </label>
            <p className="text-xs text-muted-foreground">
              Choose light, dark, or system theme
            </p>
          </div>
          
          <div className="pt-2 border-t">
            <label className="flex items-center justify-between text-sm font-medium mb-2">
              <span>E-ink Mode</span>
              <Switch
                checked={isEinkMode}
                onCheckedChange={toggleEinkMode}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Disable all animations and transitions
            </p>
          </div>
        </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 