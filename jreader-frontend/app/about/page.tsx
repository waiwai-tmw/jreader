'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { BaseHeader } from "@/components/BaseHeader"
import { Card } from '@/components/ui/card'
import { usePageTitle } from '@/hooks/usePageTitle'

// Function to fetch markdown content
async function fetchMarkdownContent() {
  try {
    const response = await fetch('/content/about.md')
    if (!response.ok) {
      throw new Error('Failed to fetch markdown content')
    }
    return await response.text()
  } catch (error) {
    console.error('Error fetching markdown content:', error)
    return '# About JReader\n\nContent could not be loaded. Please try again later.'
  }
}

export default function AboutPage() {
  const [content, setContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  usePageTitle('About - JReader');

  useEffect(() => {
    async function loadContent() {
      try {
        setIsLoading(true)
        const markdownContent = await fetchMarkdownContent()
        setContent(markdownContent)
      } catch (err) {
        setError('Failed to load content')
        console.error('Error loading markdown content:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadContent()
  }, [])

  return (
    <div className="absolute inset-0 flex flex-col">
      <BaseHeader title="About" />
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0 overflow-y-auto p-6">
          {isLoading ? (
            <div className="max-w-4xl mx-auto">
              <Card className="p-8">
                <div className="animate-pulse">
                  <div className="h-8 bg-muted rounded mb-6"></div>
                  <div className="h-4 bg-muted rounded mb-4"></div>
                  <div className="h-4 bg-muted rounded mb-4"></div>
                  <div className="h-4 bg-muted rounded mb-4"></div>
                </div>
              </Card>
            </div>
          ) : error ? (
            <div className="max-w-4xl mx-auto">
              <Card className="p-8">
                <div className="text-center text-destructive">
                  <p>{error}</p>
                </div>
              </Card>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <Card className="p-8">
                <div className="prose max-w-none">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // Custom styling for markdown elements using theme-aware colors
                      h1: ({ children }) => (
                        <h1 className="text-3xl font-bold mb-6 text-foreground">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-2xl font-semibold mb-4 mt-8 text-foreground">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-xl font-medium mb-3 mt-6 text-foreground">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="mb-4 text-muted-foreground leading-relaxed">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-4 space-y-2 text-muted-foreground [&_ul]:ml-8 [&_ul]:list-outside [&_ul]:space-y-1 [&_ul]:mt-1">
                          {children}
                        </ul>
                      ),
                      li: ({ children }) => (
                        <li className="text-muted-foreground">
                          {children}
                        </li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-foreground">
                          {children}
                        </strong>
                      ),
                      em: ({ children }) => (
                        <em className="italic text-foreground">
                          {children}
                        </em>
                      ),
                      code: ({ children }) => (
                        <code className="bg-muted px-2 py-1 rounded text-sm font-mono text-foreground">
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4 text-foreground">
                          {children}
                        </pre>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground mb-4">
                          {children}
                        </blockquote>
                      ),
                      hr: () => (
                        <hr className="my-8 border-border" />
                      ),
                      a: ({ href, children }) => (
                        <a 
                          href={href} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 underline"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 