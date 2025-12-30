/**
 * Canvas utility functions for high-performance rendering
 * Optimized for Safari and mobile devices
 */

// Safari-specific optimizations
export const isSafari = (): boolean => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

// Device pixel ratio with Safari fallback
export const getOptimalPixelRatio = (): number => {
  const ratio = window.devicePixelRatio || 1;
  // Limit pixel ratio on Safari for better performance
  return isSafari() ? Math.min(ratio, 2) : ratio;
};

// Canvas context setup with performance optimizations
export const setupCanvasContext = (ctx: CanvasRenderingContext2D): void => {
  // Disable image smoothing for crisp pixel art
  ctx.imageSmoothingEnabled = false;
  
  // Set text rendering optimizations
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  
  // Safari-specific optimizations
  if (isSafari()) {
    // Reduce shadow blur for better performance
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }
};

// Efficient color parsing with caching
const colorCache = new Map<string, string>();
export const parseColor = (color: string): string => {
  if (colorCache.has(color)) {
    return colorCache.get(color)!;
  }
  
  // Handle rgba strings
  if (color.startsWith('rgba(')) {
    colorCache.set(color, color);
    return color;
  }
  
  // Handle hex colors
  if (color.startsWith('#')) {
    colorCache.set(color, color);
    return color;
  }
  
  // Default fallback
  colorCache.set(color, 'rgba(255, 255, 255, 0.1)');
  return colorCache.get(color)!;
};

// Performance monitoring
export class PerformanceMonitor {
  private frameCount = 0;
  private lastTime = 0;
  private fps = 0;
  private isMonitoring = false;
  
  start(): void {
    this.isMonitoring = true;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.measureFPS();
  }
  
  stop(): void {
    this.isMonitoring = false;
  }
  
  private measureFPS(): void {
    if (!this.isMonitoring) return;
    
    const now = performance.now();
    this.frameCount++;
    
    if (now - this.lastTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
      this.frameCount = 0;
      this.lastTime = now;
      
      // Log performance warnings
      if (this.fps < 30) {
        console.warn(`Low FPS detected: ${this.fps}fps`);
      }
    }
    
    requestAnimationFrame(() => this.measureFPS());
  }
  
  getFPS(): number {
    return this.fps;
  }
}

// Memory-efficient trail management
export class TrailManager {
  private trail: Array<{ x: number; y: number; timestamp: number; opacity: number }> = [];
  private maxTrailLength = 8;
  private fadeTime = 500; // ms
  
  addPoint(x: number, y: number): void {
    const now = Date.now();
    
    // Remove old points
    this.trail = this.trail.filter(point => now - point.timestamp < this.fadeTime);
    
    // Add new point
    this.trail.push({
      x,
      y,
      timestamp: now,
      opacity: 1.0
    });
    
    // Limit trail length
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }
  }
  
  getTrail(): Array<{ x: number; y: number; opacity: number }> {
    const now = Date.now();
    return this.trail.map(point => ({
      x: point.x,
      y: point.y,
      opacity: Math.max(0, 1 - (now - point.timestamp) / this.fadeTime)
    })).filter(point => point.opacity > 0);
  }
  
  clear(): void {
    this.trail = [];
  }
}

// Efficient grid cell calculations
export const calculateGridDimensions = (
  containerWidth: number,
  containerHeight: number,
  weeks: number = 52,
  years: number = 100
) => {
  const offsetX = 32; // Space for year labels
  const offsetY = 48; // Space for week labels
  const rightOffset = 80; // Space for phase labels
  const bottomOffset = 60; // Space for stats panel
  
  const gridWidth = containerWidth - offsetX - rightOffset;
  const gridHeight = containerHeight - offsetY - bottomOffset;
  
  const cellWidth = gridWidth / weeks;
  const cellHeight = gridHeight / years;
  
  return {
    offsetX,
    offsetY,
    gridWidth,
    gridHeight,
    cellWidth,
    cellHeight
  };
};

// Debounced resize handler
export const createDebouncedResizeHandler = (
  callback: () => void,
  delay: number = 100
): (() => void) => {
  let timeoutId: number;
  
  return () => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(callback, delay);
  };
};

// Animation frame throttling
export class AnimationThrottler {
  private lastFrameTime = 0;
  private targetFPS = 60;
  private frameInterval = 1000 / this.targetFPS;
  
  shouldRender(currentTime: number): boolean {
    if (currentTime - this.lastFrameTime >= this.frameInterval) {
      this.lastFrameTime = currentTime;
      return true;
    }
    return false;
  }
  
  setTargetFPS(fps: number): void {
    this.targetFPS = fps;
    this.frameInterval = 1000 / fps;
  }
}
