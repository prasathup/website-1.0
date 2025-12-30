// src/lib/utils/typewriterUtils.ts
// Utility functions for typewriter animation system

/**
 * Preload all SVG image paths for the typewriter animation.
 * @param directory - The directory containing SVGs (relative to public/)
 * @param count - The number of sequentially numbered SVGs
 * @returns Array of SVG file paths
 */
export function preloadTypewriterSvgs(directory: string, count: number): string[] {
  const svgPaths: string[] = [];
  // Base SVG (Vector0)
  svgPaths.push(`${directory}Heartstopper Vector0.svg`);
  // Numbered SVGs (Vector1 through Vector{count})
  for (let i = 1; i <= count; i++) {
    svgPaths.push(`${directory}Heartstopper Vector${i}.svg`);
  }
  // Add the Hi SVG
  svgPaths.push(`${directory}Hi.svg`);
  return svgPaths;
}
