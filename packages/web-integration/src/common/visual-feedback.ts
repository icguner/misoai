/**
 * Visual feedback system for mouse movements
 */

export interface VisualFeedbackOptions {
  pointerSize?: number;
  pointerColor?: string;
  trailLength?: number;
  showTrail?: boolean;
  animationDuration?: number;
}

/**
 * JavaScript code to inject for visual mouse feedback
 */
export function getMousePointerScript(
  x: number,
  y: number,
  options: VisualFeedbackOptions = {}
): string {
  const {
    pointerSize = 20,
    pointerColor = '#ff4444',
    trailLength = 5,
    showTrail = true,
    animationDuration = 200
  } = options;

  return `
    (() => {
      // Create or update mouse pointer
      if (!window.misoaiMousePointer) {
        const pointer = document.createElement('div');
        pointer.id = 'misoai-mouse-pointer';
        pointer.style.cssText = \`
          position: fixed;
          width: ${pointerSize}px;
          height: ${pointerSize}px;
          background: ${pointerColor};
          border: 2px solid white;
          border-radius: 50%;
          pointer-events: none;
          z-index: 999999;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
          transition: all ${animationDuration}ms ease-out;
          transform: translate(-50%, -50%);
        \`;
        document.body.appendChild(pointer);
        window.misoaiMousePointer = pointer;
        
        // Initialize trail array
        window.misoaiMouseTrail = [];
      }
      
      const pointer = window.misoaiMousePointer;
      pointer.style.left = ${x}px;
      pointer.style.top = ${y}px;
      
      ${showTrail ? getTrailScript(x, y, trailLength, pointerColor) : ''}
      
      // Auto-hide after 3 seconds of inactivity
      clearTimeout(window.misoaiMouseTimeout);
      pointer.style.opacity = '1';
      window.misoaiMouseTimeout = setTimeout(() => {
        if (pointer) pointer.style.opacity = '0.3';
      }, 3000);
    })();
  `;
}

/**
 * Generate trail effect script
 */
function getTrailScript(x: number, y: number, trailLength: number, color: string): string {
  return `
    // Add current position to trail
    window.misoaiMouseTrail.push({ x: ${x}, y: ${y}, timestamp: Date.now() });
    
    // Keep only recent trail points
    if (window.misoaiMouseTrail.length > ${trailLength}) {
      window.misoaiMouseTrail.shift();
    }
    
    // Remove old trail elements
    document.querySelectorAll('.misoai-mouse-trail').forEach(el => el.remove());
    
    // Create new trail elements
    window.misoaiMouseTrail.forEach((point, index) => {
      if (index === window.misoaiMouseTrail.length - 1) return; // Skip current position
      
      const trailElement = document.createElement('div');
      trailElement.className = 'misoai-mouse-trail';
      const opacity = (index + 1) / window.misoaiMouseTrail.length * 0.6;
      const size = 8 + (index + 1) / window.misoaiMouseTrail.length * 8;
      
      trailElement.style.cssText = \`
        position: fixed;
        width: \${size}px;
        height: \${size}px;
        background: ${color};
        border-radius: 50%;
        pointer-events: none;
        z-index: 999998;
        opacity: \${opacity};
        transform: translate(-50%, -50%);
        left: \${point.x}px;
        top: \${point.y}px;
      \`;
      
      document.body.appendChild(trailElement);
      
      // Auto-remove trail element after animation
      setTimeout(() => {
        if (trailElement.parentNode) {
          trailElement.parentNode.removeChild(trailElement);
        }
      }, 1000);
    });
  `;
}

/**
 * Script to clean up visual feedback elements
 */
export function getCleanupScript(): string {
  return `
    (() => {
      // Remove pointer
      if (window.misoaiMousePointer) {
        window.misoaiMousePointer.remove();
        delete window.misoaiMousePointer;
      }
      
      // Remove trail elements
      document.querySelectorAll('.misoai-mouse-trail').forEach(el => el.remove());
      delete window.misoaiMouseTrail;
      
      // Clear timeout
      if (window.misoaiMouseTimeout) {
        clearTimeout(window.misoaiMouseTimeout);
        delete window.misoaiMouseTimeout;
      }
    })();
  `;
}

/**
 * Script to show click animation
 */
export function getClickAnimationScript(x: number, y: number): string {
  return `
    (() => {
      const clickRipple = document.createElement('div');
      clickRipple.style.cssText = \`
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: 0;
        height: 0;
        border: 2px solid #ff4444;
        border-radius: 50%;
        pointer-events: none;
        z-index: 999999;
        transform: translate(-50%, -50%);
        animation: misoai-click-ripple 0.6s ease-out forwards;
      \`;
      
      // Add CSS animation if not exists
      if (!document.getElementById('misoai-click-styles')) {
        const style = document.createElement('style');
        style.id = 'misoai-click-styles';
        style.textContent = \`
          @keyframes misoai-click-ripple {
            0% {
              width: 0;
              height: 0;
              opacity: 1;
            }
            100% {
              width: 40px;
              height: 40px;
              opacity: 0;
            }
          }
        \`;
        document.head.appendChild(style);
      }
      
      document.body.appendChild(clickRipple);
      
      // Remove after animation
      setTimeout(() => {
        if (clickRipple.parentNode) {
          clickRipple.parentNode.removeChild(clickRipple);
        }
      }, 600);
    })();
  `;
}
