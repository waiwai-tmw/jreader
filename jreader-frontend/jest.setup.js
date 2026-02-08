// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SITE_URL = 'https://jreader.moe'
process.env.RENDER_EXTERNAL_URL = 'https://jreader-frontend-pr-9.onrender.com'

// Mock DOM APIs that Radix UI components require
// ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

// MutationObserver
global.MutationObserver = class MutationObserver {
  constructor() {}
  observe() {}
  disconnect() {}
  takeRecords() { return [] }
}

// requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = (cb) => setTimeout(cb, 0)
global.cancelAnimationFrame = (id) => clearTimeout(id)

// getBoundingClientRect - only define if HTMLElement exists (for DOM tests)
if (typeof HTMLElement !== 'undefined') {
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      width: 100,
      height: 100,
      top: 0,
      left: 0,
      bottom: 100,
      right: 100,
      x: 0,
      y: 0,
    }),
  })
}

// getComputedStyle - only define if window exists (for DOM tests)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'getComputedStyle', {
    value: () => ({
      getPropertyValue: () => '',
    }),
  })

  // window.visualViewport
  Object.defineProperty(window, 'visualViewport', {
    value: {
      width: 1024,
      height: 768,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
    },
    writable: true,
  })
}

// Pointer events - only define if window exists (for DOM tests)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'PointerEvent', {
    value: class PointerEvent extends Event {
      constructor(type, eventInitDict) {
        super(type, eventInitDict)
        this.pointerId = eventInitDict?.pointerId || 0
        this.width = eventInitDict?.width || 1
        this.height = eventInitDict?.height || 1
        this.pressure = eventInitDict?.pressure || 0
        this.tangentialPressure = eventInitDict?.tangentialPressure || 0
        this.tiltX = eventInitDict?.tiltX || 0
        this.tiltY = eventInitDict?.tiltY || 0
        this.twist = eventInitDict?.twist || 0
        this.pointerType = eventInitDict?.pointerType || ''
        this.isPrimary = eventInitDict?.isPrimary || false
      }
    },
  })
}

// ScrollIntoView - only define if HTMLElement exists (for DOM tests)
if (typeof HTMLElement !== 'undefined') {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: () => {},
  })
}
