
// @ts-ignore - provided by Astro at build time
import { defineCollection, z } from 'astro:content';

// Define schema for content with comprehensive media support
// We use a function to accept the context with the image helper
const contentSchema = ({ image }: { image: any }) => z.object({
  title: z.string(),
  description: z.string(),
  publishDate: z.date(),
  tags: z.array(z.string()),
  featured: z.boolean().default(false),
  // Status for drafts
  draft: z.boolean().optional(),
  caseStudy: z.boolean().default(false),

  // Project metadata
  client: z.string().optional(),
  role: z.string().optional(),
  year: z.string().optional(),
  duration: z.string().optional(),
  team: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),

  // Media configuration (optional)
  media: z.object({
    type: z.enum(['image', 'video', 'gif']).optional(),
    src: image().optional(),                       // Optimized Image (Relative path)
    publicUrl: z.string().optional(),              // Raw Public URL (e.g. /media/...)
    poster: z.string().optional(),                 // Video poster/thumbnail
    alt: z.string().optional(),                    // Accessibility text
    aspectRatio: z.string().optional(),            // Aspect ratio (optional, auto if omitted)
    autoplay: z.boolean().default(true),           // Auto-play videos
    cssClass: z.string().optional(),               // Custom CSS class for media container
    // Placement controls for primary media on detail pages
    position: z.number().int().optional(),         // Insert after Nth content section (1-based)
    insertAfterH2: z.string().optional(),          // Insert after the H2 with this exact text
    insertBeforeH2: z.string().optional(),         // Insert before the H2 with this exact text
    insertAfterH3: z.string().optional(),          // Insert after the H3 with this exact text
    insertBeforeH3: z.string().optional(),         // Insert before the H3 with this exact text
    insertAt: z.enum(['inside-top', 'inside-bottom']).optional(), // Inside section placement
  }).optional(),

  // Media Gallery (Backward compatibility)
  mediaGallery: z.array(z.object({
    type: z.enum(['image', 'video', 'gif']),
    src: image().optional(),
    publicUrl: z.string().optional(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    poster: z.string().optional(),
    aspectRatio: z.string().optional(),
    cssClass: z.string().optional(),
    position: z.number().int().optional(),
    insertAt: z.number().optional(),
    insertAfterH2: z.string().optional(),
    insertBeforeH2: z.string().optional(),
    insertAfterH3: z.string().optional(),
    insertBeforeH3: z.string().optional(),
  })).optional(),

  // Additional media for immersive layouts
  additionalMedia: z.array(z.object({
    type: z.enum(['image', 'video', 'gif']),
    src: image().optional(),
    publicUrl: z.string().optional(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    poster: z.string().optional(),
    aspectRatio: z.string().optional(),
    cssClass: z.string().optional(),
    position: z.number().int().optional(),
    insertAfterH2: z.string().optional(),
    insertBeforeH2: z.string().optional(),
    insertAfterH3: z.string().optional(),
    insertBeforeH3: z.string().optional(),
    insertAt: z.enum(['inside-top', 'inside-bottom']).optional(),
  })).optional(),

  // Layout hints
  cardSize: z.enum(['standard', 'tall', 'wide', 'hero']).default('standard'),

  // Layout variant system for flexible content presentation
  layoutVariant: z.enum(['default', 'immersive-3d', 'full-width', 'floating-bubbles']).default('default'),

  // Custom layout configuration
  layoutConfig: z.object({
    fullWidth: z.boolean().default(false),
    backgroundColor: z.string().optional(),
    customCSS: z.string().optional(),
    enableParallax: z.boolean().default(false),
    animationSpeed: z.enum(['slow', 'normal', 'fast']).default('normal'),
    // Media rendering options on detail pages
    mediaLayout: z.enum(['inline', 'gallery']).default('inline'),
    galleryColumns: z.number().int().min(2).max(4).default(3).optional(),
    galleryStyle: z.enum(['standard', 'collage']).default('standard').optional(),
    collageSeed: z.number().int().optional(),
  }).optional(),
});

// Export collections
export const collections = {
  projects: defineCollection({
    type: 'content',
    schema: contentSchema,
  }),
  journey: defineCollection({
    type: 'content',
    schema: contentSchema,
  }),
  lab: defineCollection({
    type: 'content',
    schema: contentSchema,
  }),
  notes: defineCollection({
    type: 'content',
    schema: contentSchema,
  }),
};