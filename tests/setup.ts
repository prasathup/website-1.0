// tests/setup.ts
// Global test setup and configuration

import { vi, afterEach } from 'vitest';

// Mock window properties that might not exist in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  return setTimeout(callback, 16) as unknown as number; // Simulate 60fps
});

global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id as any);
});

// Mock performance.now for animation timing tests
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  },
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Mock scrollTo and scrollBy for menu scroll tests
Element.prototype.scrollTo = vi.fn();
Element.prototype.scrollBy = vi.fn();

// Mock Material Icons font loading
Object.defineProperty(document, 'fonts', {
  writable: true,
  value: {
    ready: Promise.resolve(),
    load: vi.fn(() => Promise.resolve()),
    check: vi.fn(() => true),
    add: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    values: vi.fn(() => []),
    entries: vi.fn(() => []),
    keys: vi.fn(() => []),
    forEach: vi.fn(),
    [Symbol.iterator]: vi.fn(() => []),
    size: 0,
  },
});

// Mock URL constructor for asset paths
global.URL = class URL {
  constructor(url: string, _base?: string) {
    this.href = url;
    this.pathname = url.replace(/^https?:\/\/[^\/]+/, '');
  }
  href: string;
  pathname: string;
} as any;

// Clean up after each test
afterEach(() => {
  // Clear all mocks
  vi.clearAllMocks();
  
  // Reset DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  
  // Clear any global window properties that tests might have added
  if ((window as any).svgTypewriterAnimations) {
    delete (window as any).svgTypewriterAnimations;
  }
});

// Global test utilities
export const createMockElement = (tag: string, attributes: Record<string, string> = {}) => {
  const element = document.createElement(tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
};

export const createMockSVGTypewriterLabel = (text: string, color: string) => {
  const span = createMockElement('span', {
    'data-text': text,
    'data-color': color,
    'class': 'svg-typewriter-label'
  });
  
  // Add character spans
  text.split('').forEach(char => {
    const charSpan = createMockElement('span', {
      'data-char': char,
      'class': 'svg-typewriter-char'
    });
    span.appendChild(charSpan);
  });
  
  return span;
};

export const waitForAnimation = (duration = 100) => {
  return new Promise(resolve => setTimeout(resolve, duration));
}; 