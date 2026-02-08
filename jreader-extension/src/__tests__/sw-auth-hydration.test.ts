import { SW_EVENT_AUTH_IS_AUTHENTICATED, ExtensionAuthStatusKind } from '@jreader/shared-types-ts/extensionAvailability'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Capture the onMessage listener the SW registers
let messageListener: ((request: any, sender: any, sendResponse: (resp: any) => void) => true | void) | null = null

// Mock browser APIs used by sw-main.ts
const mockBrowser: any = {
  runtime: {
    id: 'test-extension-id',
    onMessage: {
      addListener: vi.fn((cb: any) => { messageListener = cb })
    },
    onConnect: {
      addListener: vi.fn()
    },
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() },
    getManifest: vi.fn(() => ({ version: '1.0.0' }))
  },
  storage: {
    session: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {})
    },
    local: {
      get: vi.fn(async () => ({})),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
      clear: vi.fn(async () => {})
    }
  },
  action: {
    setBadgeText: vi.fn(async () => {}),
    setBadgeBackgroundColor: vi.fn(async () => {}),
    setTitle: vi.fn(async () => {}),
    openPopup: vi.fn(async () => {})
  },
  tabs: {
    query: vi.fn(async () => []),
    sendMessage: vi.fn(async () => {})
  }
}

vi.mock('@/lib/browser', () => ({
  browser: mockBrowser,
  getBrowserInfo: vi.fn(() => 'chrome')
}))

// Mock extensionAuth with overridable fns per test
const mockGetCurrentSession = vi.fn()
const mockRestoreSessionIfAny = vi.fn()
const mockIsAuthenticated = vi.fn()

vi.mock('@/lib/extensionAuth', () => ({
  getCurrentSession: mockGetCurrentSession,
  restoreSessionIfAny: mockRestoreSessionIfAny,
  isAuthenticated: mockIsAuthenticated,
  getClient: vi.fn()
}))

describe('Service worker auth hydration before isAuthenticated', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Ensure module re-executes and re-registers listeners each test
    vi.resetModules()
    messageListener = null

    // Silence logs
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Import SW to register listeners
    await import('@/sw-main')
    expect(mockBrowser.runtime.onMessage.addListener).toHaveBeenCalled()
    expect(messageListener).toBeTruthy()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rehydrates when no current session, then returns authenticated=true', async () => {
    mockGetCurrentSession.mockResolvedValueOnce(null)
    const fakeSession = { access_token: 'a', refresh_token: 'b', user: { id: 'u' } }
    mockRestoreSessionIfAny.mockResolvedValueOnce(fakeSession)
    mockIsAuthenticated.mockResolvedValueOnce(true)

    const sendResponse = vi.fn()
    // Invoke the listener
    const rv = (messageListener as any)({ type: SW_EVENT_AUTH_IS_AUTHENTICATED }, {}, sendResponse)
    expect(rv).toBe(true) // async response

    // Wait for async body to run
    for (let i = 0; i < 10 && sendResponse.mock.calls.length === 0; i++) {
      await new Promise(r => setTimeout(r, 10))
    }

    expect(mockGetCurrentSession).toHaveBeenCalled()
    expect(mockRestoreSessionIfAny).toHaveBeenCalled()
    expect(mockIsAuthenticated).toHaveBeenCalled()
    expect(sendResponse).toHaveBeenCalledWith({
      type: SW_EVENT_AUTH_IS_AUTHENTICATED,
      extensionAuthStatus: { kind: ExtensionAuthStatusKind.AUTHENTICATED }
    })
  })

  it('rehydrates attempt does nothing and returns authenticated=false', async () => {
    mockGetCurrentSession.mockResolvedValueOnce(null)
    mockRestoreSessionIfAny.mockResolvedValueOnce(null)
    mockIsAuthenticated.mockResolvedValueOnce(false)

    const sendResponse = vi.fn()
    const rv = (messageListener as any)({ type: SW_EVENT_AUTH_IS_AUTHENTICATED }, {}, sendResponse)
    expect(rv).toBe(true)

    for (let i = 0; i < 10 && sendResponse.mock.calls.length === 0; i++) {
      await new Promise(r => setTimeout(r, 10))
    }

    expect(mockGetCurrentSession).toHaveBeenCalled()
    expect(mockRestoreSessionIfAny).toHaveBeenCalled()
    expect(mockIsAuthenticated).toHaveBeenCalled()
    expect(sendResponse).toHaveBeenCalledWith({
      type: SW_EVENT_AUTH_IS_AUTHENTICATED,
      extensionAuthStatus: { kind: ExtensionAuthStatusKind.UNAUTHENTICATED }
    })
  })

  it('skips restore if a current session already exists', async () => {
    const existingSession = { access_token: 'x', refresh_token: 'y' }
    mockGetCurrentSession.mockResolvedValueOnce(existingSession)
    // restore should not be called
    mockIsAuthenticated.mockResolvedValueOnce(true)

    const sendResponse = vi.fn()
    const rv = (messageListener as any)({ type: SW_EVENT_AUTH_IS_AUTHENTICATED }, {}, sendResponse)
    expect(rv).toBe(true)

    for (let i = 0; i < 10 && sendResponse.mock.calls.length === 0; i++) {
      await new Promise(r => setTimeout(r, 10))
    }

    expect(mockGetCurrentSession).toHaveBeenCalled()
    expect(mockRestoreSessionIfAny).not.toHaveBeenCalled()
    expect(mockIsAuthenticated).toHaveBeenCalled()
    expect(sendResponse).toHaveBeenCalledWith({
      type: SW_EVENT_AUTH_IS_AUTHENTICATED,
      extensionAuthStatus: { kind: ExtensionAuthStatusKind.AUTHENTICATED }
    })
  })
})
