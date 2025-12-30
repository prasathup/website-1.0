/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'jsdom',
    
    // Global test setup
    globals: true,
    
    // File patterns for tests
    include: [
      'src/**/*.{test,spec}.{js,ts}',
      'tests/**/*.{test,spec}.{js,ts}'
    ],
    
    // File patterns to exclude
    exclude: [
      'node_modules',
      'dist',
      '.astro'
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '.astro/',
        'src/**/*.d.ts',
        'src/**/*.config.*',
        'tests/'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    
    // Test timeout (useful for animation tests)
    testTimeout: 10000,
    
    // Setup files
    setupFiles: ['./tests/setup.ts'],
    
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    
    // Reporter configuration
    reporters: ['verbose'],
    
    // Alias configuration to match tsconfig paths
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
      '@/components': new URL('./src/components/', import.meta.url).pathname,
      '@/lib': new URL('./src/lib/', import.meta.url).pathname,
      '@/types': new URL('./src/lib/types/', import.meta.url).pathname,
      '@/utils': new URL('./src/lib/utils/', import.meta.url).pathname,
      '@/services': new URL('./src/lib/services/', import.meta.url).pathname,
      '@/styles': new URL('./src/styles/', import.meta.url).pathname,
    }
  }
}); 