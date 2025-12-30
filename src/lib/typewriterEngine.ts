// src/lib/typewriterEngine.ts
// Typewriter animation engine for SVG-based text reveal
// Optimized for step-based "Sketch to Text" animation

interface TypewriterConfig {
  text: string;
  svgPaths?: string[];
  // Configurable parameters for the new approach
  stepConfig?: {
    maxSvgs: number; // How many sketches before reveal
    svgDuration: number; // Duration of each sketch in ms
    revealDuration: number; // Fade in duration for text
  };
  timing: {
    characterDelay: number; // Delay between characters starting
    transitionDuration?: number;
    svgCycleSpeed?: number; // Deprecated, using stepConfig.svgDuration
  };
  // Deprecated but kept for interface compat if needed
  maxPhases?: number; 
  intervalMs?: number;
}

interface CharState {
  step: number; // 0 = Hidden, 1..N = SVG steps, N+1 = Revealing Text, N+2 = Done
  startTime: number; // When this char started animating
  svgsToShow: string[]; // Pre-calculated sequence of SVGs for this char
}

/**
 * TypewriterEngine animates SVG-based text reveal using a Step-Based approach.
 * 
 * Flow per character:
 * 1. Wait for start time (based on index * delay)
 * 2. Show SVG 1 (hold for duration)
 * 3. Show SVG 2 (hold for duration)
 * ... (up to maxSvgs)
 * 4. Reveal Text (Fade in, cut SVG out)
 */
export class TypewriterEngine {
  private animationFrameId: number | null = null;
  private isAnimating = false;
  private charStates: CharState[] = [];
  private startTime: number = 0;
  
  // Configuration defaults
  private defaultMaxSvgs = 2; // Only 2 sketches before text
  private defaultSvgDuration = 250; // Slow sketches (250ms each)
  private defaultRevealDuration = 300; // Soft fade in for text
  
  constructor(private element: HTMLElement, private config: TypewriterConfig) {
    this.resetState();
  }

  private resetState() {
    // Pre-calculate random SVGs for each character so they are deterministic during the run
    const svgPaths = this.config.svgPaths || [];
    const maxSvgs = this.config.stepConfig?.maxSvgs ?? this.defaultMaxSvgs;
    
    this.charStates = Array(this.config.text.length).fill(null).map(() => {
      const svgs: string[] = [];
      if (svgPaths.length > 0) {
        for (let i = 0; i < maxSvgs; i++) {
          const choice = svgPaths[Math.floor(Math.random() * svgPaths.length)] ?? '';
          svgs.push(choice);
        }
      }
      return {
        step: 0,
        startTime: 0,
        svgsToShow: svgs
      };
    });
  }

  public start() {
    if (this.isAnimating) return;
    this.isAnimating = true;
    this.resetState();
    this.startTime = performance.now();
    
    // Initial setup
    const svgContainers = Array.from(this.element.querySelectorAll('.svg-container'));
    svgContainers.forEach(c => {
      c.classList.add('changing');
      c.innerHTML = ''; 
    });

    this.animate(this.startTime);
  }

  private animate = (timestamp: number) => {
    if (!this.isAnimating) return;

    const elapsed = timestamp - this.startTime;
    
    const text = this.config.text;
    const charDelay = this.config.timing.characterDelay || 100;
    const maxSvgs = this.config.stepConfig?.maxSvgs ?? this.defaultMaxSvgs;
    const svgDuration = this.config.stepConfig?.svgDuration ?? this.defaultSvgDuration;
    // const revealDuration = this.config.stepConfig?.revealDuration ?? this.defaultRevealDuration;

    const svgContainers = Array.from(this.element.querySelectorAll('.svg-container'));
    let allComplete = true;

      svgContainers.forEach((container, index) => {
      const state = this.charStates[index];
      if (!state) {
        allComplete = false;
        return;
      }
      
      // If fully done, skip
      if (state.step > maxSvgs + 1) return;

      // Calculate start time for this character
      const charStartTime = index * charDelay;
      
      // If we haven't reached this character's start time, do nothing
      if (elapsed < charStartTime) {
        allComplete = false;
            return;
          }
          
      // Determine which step we should be in based on time since char start
      const timeSinceStart = elapsed - charStartTime;
      
      // Steps 1..maxSvgs correspond to SVGs
      // Step maxSvgs + 1 corresponds to Text Reveal
      
      let targetStep = Math.floor(timeSinceStart / svgDuration) + 1;
      
      // Cap at Text Reveal step
      if (targetStep > maxSvgs + 1) {
        targetStep = maxSvgs + 1;
      }
      
      // State Change Logic
      if (targetStep > state.step) {
        state.step = targetStep;
        
        if (state.step <= maxSvgs) {
          // Show SVG
          if (text[index] !== ' ') {
             this.renderSvg(container, state.svgsToShow[state.step - 1] ?? '');
          } else {
             // Spaces just finish
             this.finalizeChar(container, ' ');
             state.step = maxSvgs + 2; // Mark complete
          }
        } else {
          // Show Text
          this.finalizeChar(container, text[index] ?? '');
          state.step = maxSvgs + 2; // Mark complete
        }
      }
      
      if (state.step <= maxSvgs + 1) {
        allComplete = false;
      }
    });

    if (!allComplete) {
      this.animationFrameId = requestAnimationFrame(this.animate);
    } else {
      this.isAnimating = false;
        }
  };

  private renderSvg(container: Element, svgPath: string) {
    // Clean previous content
          container.innerHTML = '';
    
    // Fallback to IMG tag to guarantee visibility, but add crisp rendering
    const img = document.createElement('img');
    img.src = svgPath;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    
    // Ensure high quality rendering to reduce pixelation
    // (works in most modern browsers for downscaling/upscaling)
    img.style.imageRendering = '-webkit-optimize-contrast'; 
    
    container.appendChild(img);
  }

  private finalizeChar(container: Element, char: string) {
    // Clear SVG instantly (Avoid Overlap)
    container.innerHTML = '';
    container.classList.remove('changing');
    
    const charSpan = document.createElement('span');
    charSpan.textContent = char;
    charSpan.classList.add('svg-final');
    
    // Set initial state for fade-in
    charSpan.style.opacity = '0';
    // Standard transition duration from CSS class or inline
    charSpan.style.transition = `opacity ${this.config.stepConfig?.revealDuration ?? this.defaultRevealDuration}ms ease-out`;
    
    container.appendChild(charSpan);
    
    // Trigger Fade In
    requestAnimationFrame(() => {
      charSpan.style.opacity = '1';
    });
  }

  public stop() {
    this.isAnimating = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    const text = this.config.text;
    const svgContainers = Array.from(this.element.querySelectorAll('.svg-container'));
    svgContainers.forEach((container, index) => {
      this.finalizeChar(container, text[index] ?? '');
       // Force immediate visibility
       const span = container.querySelector('span');
       if (span) {
         span.style.opacity = '1';
         span.style.transition = 'none';
  }
    });
  }

  public resetToText() {
    this.stop();
  }
  }
