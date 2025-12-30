// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  // Set custom domain for canonical URLs and SEO
  site: 'https://prasathup.com',

  // IMPORTANT: Ensure consistent trailing slash behavior between dev and production
  // 'never' = URLs never have trailing slash (e.g., /projects not /projects/)
  // This prevents pathname matching issues in components like Menu
  trailingSlash: 'never',

  integrations: [tailwind()],
  // markdown: { rehypePlugins: [] },
  devToolbar: {
    enabled: false, // Disable the DevToolbar
  },
  vite: {
    ssr: {
      // Include these packages in the SSR bundle
      // Since they're used in client-side scripts, we need Vite to resolve them
      noExternal: ['three', 'gsap']
    },
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true
        }
      }
    },
    optimizeDeps: {
      // Pre-bundle these dependencies for faster dev server startup
      include: ['three', 'gsap']
    }
  },
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto' // Inlines small CSS to reduce HTTP requests
  }
});