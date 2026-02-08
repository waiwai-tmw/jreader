'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"
import { safeLocation } from "@/utils/safeWindow"

interface GuestUserCardProps {
  onDismiss: () => void
}

export function GuestUserCard({ onDismiss }: GuestUserCardProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!api) {
      return
    }

    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap())

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap())
    })

    return () => {
      api.off("select", () => {})
    }
  }, [api])

  useEffect(() => {
    if (!api) {
      return
    }

    let timer: ReturnType<typeof setInterval> | null = null

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is not in focus, stop the timer
        if (timer) {
          clearInterval(timer)
          timer = null
        }
      } else {
        // Tab is back in focus, restart the timer
        timer = setInterval(() => {
          api.scrollNext()
        }, 4000)
      }
    }

    // Start the timer if tab is visible
    if (!document.hidden) {
      timer = setInterval(() => {
        api.scrollNext()
      }, 4000)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (timer) {
        clearInterval(timer)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [api])

  const handleSignIn = useCallback(() => {
    // Store current page as redirect target
    const currentUrl = safeLocation.href
    const redirectUrl = new URL('/login', window.location.origin)
    redirectUrl.searchParams.set('redirect', currentUrl)
    safeLocation.navigate(redirectUrl.toString())
  }, [])

  const carouselSlides = [
    { title: "Bookmarks", icon: "🔖" },
    { title: "Kanji Tracking", icon: "🔤" },
    { title: "Anki Mining", icon: "📚" },
    { title: "Audio & Images", icon: "🎧" },
    { title: "Customize Dictionaries", icon: "⚙️" },
  ]

  return (
    <div className="fixed inset-0 flex items-start justify-center pt-4 sm:pt-20 z-50 pointer-events-none">
      <Card className="w-full mx-4 max-w-5xl pointer-events-auto max-h-[90vh] overflow-y-auto sm:mx-0">
        <CardHeader>
          <CardTitle>Reading as Guest</CardTitle>
          <CardDescription>
            Some features require signing in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column */}
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                You're currently reading without an account. To unlock the full JReader experience, consider signing in. This enables:
              </p>
              <ul className="text-sm space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    <strong>Bookmarks</strong>
                    <span className="hidden md:inline"> — Save your reading progress across devices</span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    <strong>Kanji Tracking</strong>
                    <span className="hidden md:inline"> — Highlight and track new kanji as you read</span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    <strong>Anki Mining</strong>
                    <span className="hidden md:inline"> — Create flash cards directly from your reading</span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    <strong>Audio & Images</strong>
                    <span className="hidden md:inline"> — Access dictionary audio and example images</span>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>
                    <strong>Customize Dictionaries</strong>
                    <span className="hidden md:inline"> — Choose preferred dictionaries, hide bilingual dictionaries behind a spoiler</span>
                  </span>
                </li>
              </ul>
              <p className="text-sm text-foreground">
                Creating an account is completely free, no payment info required.
              </p>
            </div>

            {/* Right Column - Carousel */}
            <div className="flex items-center justify-center">
              <div className="relative w-full">
                <Carousel
                  opts={{
                    align: "center",
                    loop: true,
                  }}
                  setApi={setApi}
                  className="w-full"
                >
                  <CarouselContent className="-ml-2">
                    {carouselSlides.map((slide, index) => (
                      <CarouselItem key={index} className="pl-2 basis-full">
                        <div className="flex flex-col items-center justify-center gap-4 p-6 sm:p-8 bg-muted rounded-lg min-h-56 sm:min-h-64">
                          <div className="text-4xl sm:text-6xl">{slide.icon}</div>
                          <div className="text-center">
                            <h3 className="font-semibold text-base sm:text-lg">{slide.title}</h3>
                            <p className="text-xs text-muted-foreground mt-1">[Screenshot will appear here]</p>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>

                {/* Navigation dots */}
                <div className="flex justify-center gap-2 mt-2">
                  {Array.from({ length: count }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => api?.scrollTo(index)}
                      className={`h-2 w-2 rounded-full transition-all ${
                        index === current ? "bg-foreground" : "bg-muted-foreground"
                      }`}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 flex flex-col gap-3 max-w-xs mx-auto">
          <Button
            variant="outline"
            onClick={onDismiss}
            className="w-full text-sm sm:text-base"
          >
            Continue As Guest
          </Button>
          <Button
            onClick={handleSignIn}
            className="w-full text-sm sm:text-base"
          >
            Sign In
          </Button>
        </div>
      </Card>
    </div>
  )
}
