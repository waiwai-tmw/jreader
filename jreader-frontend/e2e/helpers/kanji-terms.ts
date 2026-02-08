/**
 * Helper function to find kanji-only clickable terms within search result definitions
 * This is useful for testing recursive searches by clicking on terms within definitions
 * rather than breadcrumb links.
 */
 // Helper function to find a kanji-only clickable term within definitions (not headers)
 export async function findKanjiClickableTerm(page: any, targetText?: string, excludeStartsWith?: string | string[]) {
   // Normalize excludeStartsWith to an array
   const excludeChars = Array.isArray(excludeStartsWith) ? excludeStartsWith : (excludeStartsWith ? [excludeStartsWith] : [])

   try {
     // Use page.evaluate to extract all span data in a single browser operation
     const spanData = await page.evaluate(() => {
       const spans = Array.from(
         document.querySelectorAll('div[data-testid*="search-results-definitions"] span.cursor-pointer')
       )
       return spans.map(span => ({
         text: span.textContent || '',
         isVisible: (span.offsetParent !== null), // Simple visibility check
         element: span,
       }))
     })

     console.log(`[findKanjiClickableTerm] Found ${spanData.length} clickable terms total, searching for: ${targetText || 'any kanji term'}`)

     const kanjiOnlyRegex = /^[\u4E00-\u9FFF]+$/
     const singleKanjiRegex = /^[\u4E00-\u9FFF]$/

     for (let i = 0; i < spanData.length; i++) {
       const { text, isVisible } = spanData[i]

       // Skip if not visible or not kanji
       if (!isVisible || !text || !singleKanjiRegex.test(text)) {
         continue
       }

       // Scan ahead to accumulate the full term
       let accumulatedText = text
       let currentIndex = i + 1
       let matchedIndex = i

       while (currentIndex < spanData.length) {
         const { text: nextText, isVisible: nextIsVisible } = spanData[currentIndex]

         if (!nextIsVisible || !nextText || !singleKanjiRegex.test(nextText)) {
           break
         }

         accumulatedText += nextText
         matchedIndex = currentIndex
         currentIndex++

         // Stop if we've matched the target or accumulated enough
         if (targetText && accumulatedText === targetText) {
           break
         }
         if (!targetText && accumulatedText.length >= 2) {
           break
         }
       }

       // Check if accumulated text meets criteria
       if (!kanjiOnlyRegex.test(accumulatedText) || accumulatedText.length < 2) {
         continue
       }

       // Skip if this term starts with any of the excluded characters
       if (excludeChars.some(char => accumulatedText.startsWith(char))) {
         continue
       }

       // If targetText is provided, only accept exact matches
       if (targetText && accumulatedText !== targetText) {
         continue
       }

       console.log(`[findKanjiClickableTerm] [${i}] MATCH FOUND: "${accumulatedText}"`)
       console.log(`[findKanjiClickableTerm] RETURNING: text="${accumulatedText}"`)

       // Get the locator for the matched span
       const allClickableTerms = page.locator('div[data-testid*="search-results-definitions"] span.cursor-pointer')
       const term = allClickableTerms.nth(i)

       return { term, text: accumulatedText }
     }

     console.log(`[findKanjiClickableTerm] No matching term found`)
   } catch (error) {
     console.error('Error in findKanjiClickableTerm:', error)
   }

   return null
 }
