// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  // Set custom domain for canonical URLs and SEO
  site: 'https://example.com',

  // IMPORTANT: Ensure consistent trailing slash behavior between dev and production
  // 'never' = URLs never have trailing slash (e.g., /projects not /projects/)
  // This prevents pathname matching issues in components like Menu
  trailingSlash: 'never',

  integrations: [tailwind()],
  // markdown: { rehypePlugins: [] },
  devToolbar: {
    enabled: false, // Disable the DevToolbar
  },
  // Image optimization configuration
  // Note: Sharp (default image service) preserves color profiles when format matches (PNG to PNG)
  // Using quality="max" and format="png" in Image components ensures color profiles are maintained
  // This is especially important for Notes art created in Procreate with intentional color profiles
  vite: {
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true
        }
      }
    }
  },
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto' // Inlines small CSS to reduce HTTP requests
  }
});