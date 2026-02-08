import { isValidInternalUrl } from '@/utils/urlValidation'

describe('isValidInternalUrl', () => {
  it('should accept valid internal URLs', () => {
    expect(isValidInternalUrl('/library')).toBe(true)
    expect(isValidInternalUrl('/settings')).toBe(true)
    expect(isValidInternalUrl('/dictionary/word')).toBe(true)
    expect(isValidInternalUrl('/library/123?page=5')).toBe(true)
  })

  it('should reject external URLs', () => {
    expect(isValidInternalUrl('https://malicious-site.com')).toBe(false)
    expect(isValidInternalUrl('https://evil.com/steal-data')).toBe(false)
    expect(isValidInternalUrl('http://phishing-site.net')).toBe(false)
    expect(isValidInternalUrl('https://jreader.moe.evil.com')).toBe(false)
  })

  it('should reject dangerous URLs', () => {
    expect(isValidInternalUrl('javascript:alert("xss")')).toBe(false)
    expect(isValidInternalUrl('data:text/html,<script>alert("xss")</script>')).toBe(false)
  })

  it('should reject protocol-relative URLs to external sites', () => {
    expect(isValidInternalUrl('//malicious-site.com')).toBe(false)
    expect(isValidInternalUrl('//evil.com/steal-data')).toBe(false)
  })

  it('should accept protocol-relative URLs to same origin', () => {
    const currentOrigin = window.location.origin
    expect(isValidInternalUrl(`//${currentOrigin.replace(/^https?:\/\//, '')}/library`)).toBe(true)
  })

  it('should handle URLs with query parameters and fragments', () => {
    expect(isValidInternalUrl('/library?book=123&page=5#section')).toBe(true)
    expect(isValidInternalUrl('/dictionary/word?highlight=true&search=term')).toBe(true)
  })

  it('should reject URLs with different protocols', () => {
    expect(isValidInternalUrl('ftp://jreader.moe')).toBe(false)
    expect(isValidInternalUrl('file:///etc/passwd')).toBe(false)
  })

  it('should handle edge cases', () => {
    expect(isValidInternalUrl('/')).toBe(true)
    expect(isValidInternalUrl('/?redirect=external')).toBe(true) // Query params are allowed
    expect(isValidInternalUrl('/#external-link')).toBe(true) // Fragments are allowed
  })
})
