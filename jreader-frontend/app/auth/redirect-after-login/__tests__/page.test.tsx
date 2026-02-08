import { render, screen, waitFor } from '@testing-library/react'
import { useRouter, useSearchParams } from 'next/navigation'

import RedirectAfterLogin from '../page'

// Mock Next.js navigation hooks
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}))

// Mock localStorage and sessionStorage
const localStorageMock = {
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
}

const sessionStorageMock = {
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
})

describe('RedirectAfterLogin', () => {
  const mockPush = jest.fn()
  let searchParamsStore: Record<string, string> = {}
  const mockSearchParams = {
    get: (key: string) => searchParamsStore[key] ?? null,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReset()
    sessionStorageMock.getItem.mockReset()
    localStorageMock.removeItem.mockReset()
    sessionStorageMock.removeItem.mockReset()
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)
    searchParamsStore = {}
    searchParamsStore['next'] = '/'
  })

  it('should redirect to stored localStorage URL if valid internal URL', async () => {
    localStorageMock.getItem.mockReturnValue('/library')
    
    render(<RedirectAfterLogin />)
    
    await waitFor(() => {
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('redirectAfterLogin')
      expect(mockPush).toHaveBeenCalledWith('/library')
    })
  })

  it('should redirect to stored sessionStorage URL if valid internal URL', async () => {
    localStorageMock.getItem.mockReturnValue(null)
    sessionStorageMock.getItem.mockReturnValue('/dictionary/word')
    
    render(<RedirectAfterLogin />)
    
    await waitFor(() => {
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('dictionaryRedirectUrl')
      expect(mockPush).toHaveBeenCalledWith('/dictionary/word')
    })
  })

  it('should redirect to default next URL if no stored URLs', async () => {
    localStorageMock.getItem.mockReturnValue(null)
    sessionStorageMock.getItem.mockReturnValue(null)
    searchParamsStore['next'] = '/settings'
    
    render(<RedirectAfterLogin />)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/settings')
    })
  })

  it('should redirect to default next URL if stored localStorage URL is external', async () => {
    localStorageMock.getItem.mockReturnValue('https://malicious-site.com')
    sessionStorageMock.getItem.mockReturnValue(null)
    
    render(<RedirectAfterLogin />)
    
    await waitFor(() => {
      expect(localStorageMock.removeItem).not.toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('should redirect to default next URL if stored sessionStorage URL is external', async () => {
    localStorageMock.getItem.mockReturnValue(null)
    sessionStorageMock.getItem.mockReturnValue('https://evil.com/steal-data')
    
    render(<RedirectAfterLogin />)
    
    await waitFor(() => {
      expect(sessionStorageMock.removeItem).not.toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('should redirect to default next URL if stored URL is malformed', async () => {
    localStorageMock.getItem.mockReturnValue('javascript:alert("xss")')
    sessionStorageMock.getItem.mockReturnValue(null)
    
    render(<RedirectAfterLogin />)
    
    await waitFor(() => {
      expect(localStorageMock.removeItem).not.toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('should prioritize localStorage over sessionStorage', async () => {
    localStorageMock.getItem.mockReturnValue('/library')
    sessionStorageMock.getItem.mockReturnValue('/dictionary/word')
    
    render(<RedirectAfterLogin />)
    
    await waitFor(() => {
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('redirectAfterLogin')
      expect(sessionStorageMock.removeItem).not.toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/library')
    })
  })

  it('should display loading message', () => {
    render(<RedirectAfterLogin />)
    
    expect(screen.getByText('Logging you in...')).toBeInTheDocument()
    expect(screen.getByText('Please wait while we redirect you.')).toBeInTheDocument()
  })

  it('should handle relative URLs correctly', async () => {
    localStorageMock.getItem.mockReturnValue('/library/123?page=5')
    
    render(<RedirectAfterLogin />)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/library/123?page=5')
    })
  })

  it('should handle URLs with query parameters', async () => {
    localStorageMock.getItem.mockReturnValue(null)
    sessionStorageMock.getItem.mockReturnValue('/dictionary/word?highlight=true')
    
    render(<RedirectAfterLogin />)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dictionary/word?highlight=true')
    })
  })

  it('should handle empty string URLs', async () => {
    localStorageMock.getItem.mockReturnValue('')
    sessionStorageMock.getItem.mockReturnValue(null)
    
    render(<RedirectAfterLogin />)
    
    await waitFor(() => {
      expect(localStorageMock.removeItem).not.toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('should handle null/undefined next parameter', async () => {
    localStorageMock.getItem.mockReturnValue(null)
    sessionStorageMock.getItem.mockReturnValue(null)
    searchParamsStore = {} // No 'next' parameter
    
    render(<RedirectAfterLogin />)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('should not clear stored URLs if validation fails', async () => {
    localStorageMock.getItem.mockReturnValue('https://evil.com')
    sessionStorageMock.getItem.mockReturnValue('https://malicious.com')
    
    render(<RedirectAfterLogin />)
    
    await waitFor(() => {
      // Should not clear invalid URLs (security measure)
      expect(localStorageMock.removeItem).not.toHaveBeenCalled()
      expect(sessionStorageMock.removeItem).not.toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('should reject external URLs in next parameter', async () => {
    localStorageMock.getItem.mockReturnValue(null)
    sessionStorageMock.getItem.mockReturnValue(null)
    searchParamsStore['next'] = 'https://malicious-site.com'
    
    render(<RedirectAfterLogin />)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  it('should accept valid internal URLs in next parameter', async () => {
    localStorageMock.getItem.mockReturnValue(null)
    sessionStorageMock.getItem.mockReturnValue(null)
    searchParamsStore['next'] = '/settings'
    
    render(<RedirectAfterLogin />)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/settings')
    })
  })
})
