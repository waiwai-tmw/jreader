'use client';

import { BookOpen, MousePointerClick, ArrowRightLeft, LogIn, LogOut, Search, PieChart, ExternalLink, Download } from "lucide-react"

import ActivityHeatmap from './ActivityHeatmap'
import NovelCountDisplay from './NovelCountDisplay'

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useAuth } from '@/contexts/AuthContext'


export default function WelcomeScreen() {
  const { user, isLoading, signIn, signOut } = useAuth()



  return (
    <Card className="w-full">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <BookOpen className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-3xl">Welcome to JReader</CardTitle>
          <CardDescription>Your Japanese reading companion</CardDescription>
          
          {/* Authentication Section */}
          <div className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                <span>Loading...</span>
              </div>
            ) : user ? (
              <div className="flex items-center justify-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{user.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={signIn}
                className="gap-2"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {user && (
            <>
              <section>
                <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                  <PieChart className="h-5 w-5" />
                  Your Activity
                </h2>
                <ActivityHeatmap />
              </section>
              <Separator />
            </>
          )}
          <section>
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <BookOpen className="h-5 w-5" />
              Reading Features
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2 mb-3">
                  <MousePointerClick className="h-4 w-4" />
                  Reading Modes
                </h3>
                <p className="text-muted-foreground mb-3">
                  JReader has two modes for interacting with text. Press <kbd className="px-2 py-0.5 bg-muted rounded-md font-mono text-sm">Option/Alt</kbd> to switch between them:
                </p>
                <div className="grid grid-cols-[auto,1fr] gap-4 items-center">
                  <span className={`
                    text-xs font-mono px-2 py-0.5
                    border rounded
                    border-border text-muted-foreground
                  `}>
                    READ
                  </span>
                  <span className="text-muted-foreground">
                    Click words to look them up in the dictionary
                  </span>
                  
                  <span className={`
                    text-xs font-mono px-2 py-0.5
                    border rounded
                    bg-yellow-100 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100
                  `}>
                    KANJI
                  </span>
                  <span className="text-muted-foreground">
                    Click words to mark their kanji as known
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium flex items-center gap-2 mb-3">
                  <ArrowRightLeft className="h-4 w-4" />
                  Kanji Status Colors
                </h3>
                <div className="grid grid-cols-[auto,1fr] gap-4 items-center">
                  <span className="px-3 py-1.5 rounded-md kanji-known">
                    漢
                  </span>
                  <span className="text-muted-foreground">Known kanji</span>
                  
                  <span 
                    className="px-3 py-1.5 rounded-md kanji-encountered"
                  >
                    字
                  </span>
                  <span className="text-muted-foreground">Encountered kanji</span>
                  
                  <span 
                    className="px-3 py-1.5 rounded-md kanji-not-mined"
                  >
                    読
                  </span>
                  <span className="text-muted-foreground">Not mined kanji</span>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Download className="h-5 w-5" />
              Import from Narou
            </h2>
            <p className="text-muted-foreground mb-4">
              Import Japanese web novels directly from <a href="https://syosetu.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Narou <ExternalLink className="h-3 w-3" /></a> with just a URL in the <a href="/library" className="text-primary hover:underline">Library</a>. Many popular series have already been imported and are instantly available!
            </p>
            <div className="space-y-3">
              <NovelCountDisplay />
              <div className="text-sm text-muted-foreground">
                • Paste any Narou URL to import<br/>
                • Automatic EPUB generation with proper formatting<br/>
                • Full integration with JReader's reading and lookup features<br/>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="/library" className="flex items-center gap-2">
                  Go to Library
                </a>
              </Button>
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Search className="h-5 w-5" />
              Standalone Dictionary
            </h2>
            <p className="text-muted-foreground mb-3">
              Access the <a href="/dictionary" className="text-primary hover:underline">dictionary</a> directly without uploading a book. Perfect for quick lookups and studying.
            </p>
            <div className="text-sm text-muted-foreground">
              • Search any Japanese word or phrase<br/>
              • Access dozens of dictionaries including Pixiv and Wikipedia<br/>
              • View pitch accent graphs<br/>
              • Hide dictionaries with spoiler tags
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/dictionary" className="flex items-center gap-2">
                Go to Dictionary
              </a>
            </Button>
          </section>

          <Separator />

          <section>
            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <PieChart className="h-5 w-5" />
              Already know a lot of kanji?
            </h2>
            <p className="text-muted-foreground mb-4">
              If you don't want to start from scratch, you can import your existing kanji knowledge or mark entire Kanji Grid sections as Known in the <a href="/stats" className="text-primary hover:underline">stats page</a>.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="/stats" className="flex items-center gap-2">
                Go to Stats Page
              </a>
            </Button>
          </section>

          <Separator />

          <div className="text-center text-sm text-muted-foreground">
            Upload or import a book to begin reading, or use the dictionary for quick lookups
          </div>
        </CardContent>
      </Card>
  )
} 