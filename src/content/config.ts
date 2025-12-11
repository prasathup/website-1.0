// @ts-ignore - provided by Astro at build time
import { defineCollection, z } from 'astro:content';

// Define schema for content with comprehensive media support
const contentSchema = z.object({
  title: z.string(),
  description: z.string(),
  publishDate: z.date(),
  tags: z.array(z.string()),
  featured: z.boolean().default(false),
  
  // Media configuration (optional)
  media: z.object({
    type: z.enum(['image', 'video', 'gif']).optional(),
    src: z.string().optional(),                    // Media file path
    poster: z.string().optional(),                 // Video poster/thumbnail
    alt: z.string().optional(),                    // Accessibility text
    aspectRatio: z.string().optional(),            // Aspect ratio (optional, auto if omitted)
    autoplay: z.boolean().default(true),           // Auto-play videos
    // hoverPreview removed - was causing inconsistency
    cssClass: z.string().optional(),               // Custom CSS class for media container
    // Placement controls for primary media on detail pages
    position: z.number().int().optional(),         // Insert after Nth content section (1-based)
    insertAfterH2: z.string().optional(),          // Insert after the H2 with this exact text
    insertBeforeH2: z.string().optional(),         // Insert before the H2 with this exact text
    insertAfterH3: z.string().optional(),          // Insert after the H3 with this exact text
    insertBeforeH3: z.string().optional(),         // Insert before the H3 with this exact text
    insertAt: z.enum(['inside-top','inside-bottom']).optional(), // Inside section placement
  }).optional(),
  
  // Additional media for immersive layouts
  additionalMedia: z.array(z.object({
    type: z.enum(['image', 'video', 'gif']),
    src: z.string(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    poster: z.string().optional(),
    aspectRatio: z.string().default('16/9'),   // Per-media aspect ratio on detail page
    cssClass: z.string().optional(),           // Custom CSS class for media container
    position: z.number().int().optional(),     // Insert after Nth content section (1-based)
    insertAfterH2: z.string().optional(),      // Insert after the H2 with this exact text
    insertBeforeH2: z.string().optional(),     // Insert before the H2 with this exact text
    insertAfterH3: z.string().optional(),      // Insert after the H3 with this exact text
    insertBeforeH3: z.string().optional(),     // Insert before the H3 with this exact text
    insertAt: z.enum(['inside-top','inside-bottom']).optional(), // Inside section placement
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
    galleryStyle: z.enum(['standard','collage']).default('standard').optional(),
    collageSeed: z.number().int().optional(),
  }).optional(),
  
  // Status for drafts
  draft: z.boolean().default(false),
});

// Content collections for different sections
export const collections = {
  'projects': defineCollection({ 
    type: 'content',
    schema: contentSchema 
  }),
  'lab': defineCollection({ 
    type: 'content',
    schema: contentSchema 
  }),
  'notes': defineCollection({ 
    type: 'content',
    schema: contentSchema 
  }),
  'journey': defineCollection({
    type: 'content',
    schema: contentSchema
  }),
}; 

// Rehype plugin to wrap content between H2s into .content-section blocks at build time
// Keeps markup stable on first paint; no client JS needed for grouping
export const rehypeSectionize: any = () => {
  return (tree: any) => {
    const children = tree.children || [];
    const newChildren: any[] = [];
    let currentSection: any = null;

    function startSection(h2Node: any) {
      currentSection = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['content-section'] },
        children: [h2Node]
      };
    }

    for (const node of children) {
      if (node.type === 'element' && node.tagName === 'h2') {
        if (currentSection) newChildren.push(currentSection);
        startSection(node);
      } else if (currentSection && node.type === 'element' && ['h3','p','ul','ol','img','video','figure'].includes(node.tagName)) {
        currentSection.children.push(node);
      } else {
        if (currentSection) { newChildren.push(currentSection); currentSection = null; }
        newChildren.push(node);
      }
    }
    if (currentSection) newChildren.push(currentSection);
    tree.children = newChildren;
  };
};