import { CheckCheck, PieChart } from "lucide-react"
import React from 'react'

interface DictionaryExplanationProps {
  className?: string
}

export const DictionaryExplanation = React.memo(function DictionaryExplanation({ className = "" }: DictionaryExplanationProps) {
  return (
    <div className={`space-y-6 text-muted-foreground max-w-xl mx-auto p-4 pt-8 ${className}`}>
      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold mb-3 text-foreground">
          How to use:
        </h2>
        <ul className="space-y-2 text-sm">
          <li>• Click words in definitions to search for them (recursive search)</li>
          <li>• Use the back button or breadcrumbs to return to previous searches</li>
        </ul>
      </div>

      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold mb-3 text-foreground">
          Features:
        </h2>
        <ul className="space-y-2 text-sm">
          <li>• Unknown kanji are highlighted as <span className="kanji-not-mined px-1 rounded">unknown</span></li>
          <li>• Kanji are automatically marked as <span className="kanji-encountered px-1 rounded">encountered</span> when looked up</li>
          <li>• Use the <button className="inline-flex items-center kanji-mark-known-btn" disabled><CheckCheck className="w-3 h-3" /></button> button to mark the kanji in the search term as known</li>
          <li>• Enable spoilers for any dictionary in <a href="/settings" className="text-primary hover:underline">Settings</a></li>
          <li>• Toggle kanji highlighting for within the dictionary entries in <a href="/settings" className="text-primary hover:underline">Settings</a></li>
        </ul>
      </div>

      <div className="bg-card rounded-lg border border-border p-4">
        <h2 className="text-lg font-semibold mb-3 text-foreground flex items-center gap-2">
          <PieChart className="h-4 w-4" />
          Already know a lot of kanji?
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          If you don't want to start from scratch, you can import your existing kanji knowledge or mark entire Kanji Grid sections as Known in the <a href="/stats" className="text-primary hover:underline">stats page</a>.
        </p>
        <div className="mt-3">
          <a 
            href="/stats" 
            className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium"
          >
            Go to Stats Page
          </a>
        </div>
      </div>
    </div>
  )
})
