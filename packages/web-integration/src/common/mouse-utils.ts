export interface Point {
  x: number;
  y: number;
}

export interface MouseMovementOptions {
  steps?: number;
  duration?: number;
  easing?: 'linear' | 'easeInOut' | 'easeOut' | 'easeIn';
  showVisualFeedback?: boolean;
}

/**
 * Generates human-like mouse movement path using bezier curves
 */
export function generateHumanMousePath(
  from: Point,
  to: Point,
  options: MouseMovementOptions = {}
): Point[] {
  const {
    steps = 20,
    easing = 'easeInOut'
  } = options;

  if (steps <= 1) {
    return [to];
  }

  const path: Point[] = [];
  
  // Add some randomness to make movement more human-like
  const controlPoint1 = {
    x: from.x + (to.x - from.x) * 0.25 + (Math.random() - 0.5) * 50,
    y: from.y + (to.y - from.y) * 0.25 + (Math.random() - 0.5) * 50
  };
  
  const controlPoint2 = {
    x: from.x + (to.x - from.x) * 0.75 + (Math.random() - 0.5) * 50,
    y: from.y + (to.y - from.y) * 0.75 + (Math.random() - 0.5) * 50
  };

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const easedT = applyEasing(t, easing);
    
    // Cubic bezier curve calculation
    const point = calculateBezierPoint(from, controlPoint1, controlPoint2, to, easedT);
    path.push(point);
  }

  return path;
}

/**
 * Calculate point on cubic bezier curve
 */
function calculateBezierPoint(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point {
  const oneMinusT = 1 - t;
  const oneMinusTSquared = oneMinusT * oneMinusT;
  const oneMinusTCubed = oneMinusTSquared * oneMinusT;
  const tSquared = t * t;
  const tCubed = tSquared * t;

  return {
    x: oneMinusTCubed * p0.x + 
       3 * oneMinusTSquared * t * p1.x + 
       3 * oneMinusT * tSquared * p2.x + 
       tCubed * p3.x,
    y: oneMinusTCubed * p0.y + 
       3 * oneMinusTSquared * t * p1.y + 
       3 * oneMinusT * tSquared * p2.y + 
       tCubed * p3.y
  };
}

/**
 * Apply easing function to time value
 */
function applyEasing(t: number, easing: string): number {
  switch (easing) {
    case 'linear':
      return t;
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return 1 - (1 - t) * (1 - t);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default:
      return t;
  }
}

/**
 * Calculate delay between movement steps for natural timing
 */
export function calculateStepDelay(
  totalDuration: number,
  currentStep: number,
  totalSteps: number
): number {
  // Vary the delay to make movement more natural
  const baseDelay = totalDuration / totalSteps;
  const variation = 0.3; // 30% variation
  const randomFactor = 1 + (Math.random() - 0.5) * variation;
  
  return Math.max(1, baseDelay * randomFactor);
}
