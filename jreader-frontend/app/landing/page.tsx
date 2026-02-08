import { ArrowRight, BookOpen, BookHeart, Smartphone, SquareStack, Wand2, UploadCloud } from "lucide-react"
import Link from "next/link"

import { LandingAuthCta } from "@/components/LandingAuthCta"
import ThemeSwitcher from "@/components/ThemeSwitcher"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = {
  title: "JReader — Your Japanese reading companion",
  description:
    "Read Japanese, look up words instantly, and mine to Anki effortlessly — even from your phone. Free to use, free to love.",
}

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Simple top nav */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-semibold">
            JReader
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#mobile" className="hover:text-foreground">Mobile</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <LandingAuthCta />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="w-full border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20">
          <div className="grid gap-10 md:grid-cols-2 md:gap-16 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
                <BookHeart className="mr-2 h-3.5 w-3.5" />
                Made for immersion learners, by immersion learners
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
                Read Japanese better. Mine to Anki anywhere.
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg">
                Highlight a word, get instant definitions with pitch accent and frequency, and create a polished Anki card in seconds. Works across desktop, Android, and iOS.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <LandingAuthCta />
                <Button asChild size="lg" variant="outline">
                  <Link href="/jreader-extension/options.html">Install the extension</Link>
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Works with your existing Anki setup. No clutter, just cards 💙
              </div>
            </div>
            {/* Screenshot placeholder */}
            <div className="relative">
              <Card className="p-4">
                <div className="space-y-3">
                  <Skeleton className="h-56 w-full rounded-md" />
                  <div className="grid grid-cols-3 gap-3">
                    <Skeleton className="h-20 w-full rounded-md" />
                    <Skeleton className="h-20 w-full rounded-md" />
                    <Skeleton className="h-20 w-full rounded-md" />
                  </div>
                </div>
              </Card>
              <div className="absolute -bottom-4 -left-4 hidden md:block">
                <Skeleton className="h-16 w-36 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="w-full border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20">
          <div className="mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Everything you need to learn faster</h2>
            <p className="text-muted-foreground mt-2">Powerful features without the friction.</p>
          </div>
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard icon={<BookOpen className="h-5 w-5" />} title="Instant dictionary lookup" desc="Highlight to see readings, definitions, frequency and pitch accent." />
            <FeatureCard icon={<UploadCloud className="h-5 w-5" />} title="Cross-device reading" desc="Pick up a book at home, and keep reading on the go; your progress is available anywhere." />
            <FeatureCard icon={<Wand2 className="h-5 w-5" />} title="Seamless mining experience" desc="Auto‑populate fields, keep notes consistent, and reduce manual edits." />
            <FeatureCard icon={<SquareStack className="h-5 w-5" />} title="Recursive lookups" desc="Make the monolingual transition, in a dictionary UI that gets the details right." />
            <FeatureCard icon={<BookHeart className="h-5 w-5" />} title="Clean reading, day and night" desc="A focused interface that stays out of your way while you read, with color themes to suit any mood." />
            <FeatureCard icon={<Smartphone className="h-5 w-5" />} title="Mobile mining" desc="Mine from your phone with a streamlined flow — perfect on the go." />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="w-full border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20">
          <div className="mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">How it works</h2>
            <p className="text-muted-foreground mt-2">From lookup to Anki in seconds.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Step
              number={1}
              title="Immerse anywhere"
              desc="Use the reader, or look up words in the standalone dictionary."
            />
            <Step
              number={2}
              title="Lookup & select"
              desc="Choose among the best definitions to craft the perfect card."
            />
            <Step
              number={3}
              title="Mine to Anki"
              desc="Create a card instantly and keep everything in sync automatically."
            />
          </div>
        </div>
      </section>

      {/* Mobile highlight */}
      <section id="mobile" className="w-full border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
            <div>
              <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight">Built for mobile mining</h3>
              <p className="text-muted-foreground mt-3">
                On the train or in a cafe? JReader makes quick captures effortless. Open the
                app on your phone, search or paste text, and add a fully‑formed note to Anki
                in moments.
              </p>
              <ul className="mt-6 grid gap-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2"><ArrowRight className="mt-0.5 h-4 w-4" /> Optimized tap targets and layout</li>
                <li className="flex items-start gap-2"><ArrowRight className="mt-0.5 h-4 w-4" /> Snappy dictionary search</li>
                <li className="flex items-start gap-2"><ArrowRight className="mt-0.5 h-4 w-4" /> Works with your Anki setup</li>
              </ul>
            </div>
            <div className="relative">
              <Card className="p-6">
                <div className="mx-auto grid w-full max-w-sm gap-4">
                  <Skeleton className="h-8 w-40" />
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-24 w-full rounded-md" />
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              </Card>
              <div className="absolute -right-6 -bottom-6 hidden md:block">
                <Skeleton className="h-20 w-40 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="w-full">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20 text-center">
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight">Ready to learn faster?</h3>
          <p className="text-muted-foreground mt-2">Start reading and mining words today, no manual setup required.</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/mining">Open app</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/jreader-extension/options.html">Install the extension</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 text-primary">
          {icon}
        </div>
        <div>
          <h3 className="font-medium leading-none">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
        </div>
      </div>
    </Card>
  )
}

function Step({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className="relative rounded-lg border p-5">
      <div className="absolute -top-3 -left-3 h-7 w-7 rounded-full border bg-background text-center text-sm font-medium leading-7">
        {number}
      </div>
      <h4 className="font-medium">{title}</h4>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </div>
  )
}
