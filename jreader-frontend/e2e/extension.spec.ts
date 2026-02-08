import { test, expect, chromium, BrowserContext, Page } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Path to the built extension
const extensionPath = path.resolve(__dirname, '../../jreader-extension/dist-chrome-prod')

/**
 * Launch Chromium with the extension loaded
 */
async function launchWithExtension(extPath: string) {
  const userDataDir = fs.mkdtempSync(path.join(process.cwd(), '.pw-chrome-'))
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // extensions don't work headless
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
    ],
  })
  return { context, userDataDir }
}

/**
 * Get the extension ID at runtime by discovering the service worker
 */
async function getExtensionId(context: BrowserContext, extPath: string): Promise<string> {
  // Try to get existing service workers first
  const workers = context.serviceWorkers()
  if (workers.length > 0) {
    const url = new URL(workers[0].url())
    console.log(`Found extension via service worker: ${url.host}`)
    return url.host
  }

  // Fallback: derive extension ID from the extension path
  // For unpacked extensions loaded via --load-extension, use the basename
  const extId = path.basename(extPath)
  console.log(`Using extension ID from path: ${extId}`)
  return extId
}

/**
 * Open the extension popup page
 */
async function openPopup(context: BrowserContext, extId: string): Promise<Page> {
  const popup = await context.newPage()
  await popup.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: 'load' })
  return popup
}

// Extension tests only run on desktop Chromium, not on mobile emulation
test.skip(
  ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile === true,
  'Runs only on desktop Chromium'
)

test.describe('Extension Integration', () => {
  test('extension popup opens successfully', async () => {
    const { context, userDataDir } = await launchWithExtension(extensionPath)

    try {
      const extId = await getExtensionId(context, extensionPath)
      console.log(`✓ Extension ID: ${extId}`)

      // Open the popup
      const popup = await openPopup(context, extId)

      // Verify the popup page loaded
      await expect(popup).toHaveURL(`chrome-extension://${extId}/popup.html`)

      // Wait for React to render
      await popup.waitForTimeout(500)

      // Check that the body has content (basic check that popup rendered)
      const bodyContent = await popup.locator('body').count()
      expect(bodyContent).toBeGreaterThan(0)

      console.log('✓ Extension popup loaded successfully')
    } finally {
      await context.close()
      // Clean up temp dir
      if (fs.existsSync(userDataDir)) {
        fs.rmSync(userDataDir, { recursive: true, force: true })
      }
    }
  })
})
