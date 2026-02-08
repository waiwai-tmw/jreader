import { useEffect, useState } from "react"

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)

    // Set initial value
    update()

    // Listen for changes
    if (media.addEventListener) {
      media.addEventListener("change", update)
      return () => media.removeEventListener("change", update)
    } else {
      // Fallback for older browsers
      media.addListener(update)
      return () => media.removeListener(update)
    }
  }, [query])

  return matches
}
