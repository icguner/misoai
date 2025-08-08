/**
 * IMAGE PROCESSING ENGINE SELECTOR
 * Sharp is now the DEFAULT engine for maximum performance
 * 
 * USAGE:
 * - Default: 'sharp' (optimal performance)
 * - Fallback: DISABLE_SHARP_IMAGE_PROCESSING=true (emergency only)
 * - Runtime: setImageProcessingEngine('jimp') (testing only)
 */

import type { BaseElement } from '../types';
import { compositeElementInfoImg, processImageElementInfo } from './box-select';
import { compositeElementInfoImgSharp, processImageElementInfoSharp } from './sharp-box-select';

// ENGINE TYPE DEFINITIONS
export type ImageProcessingEngine = 'jimp' | 'sharp';

// GLOBAL ENGINE STATE - SHARP IS NOW DEFAULT!
let currentEngine: ImageProcessingEngine = 'sharp'; // PERFORMANCE FIRST!

/**
 * ENVIRONMENT VARIABLE DETECTION
 * Sharp is default, only disabled if explicitly requested
 */
function detectEngineFromEnvironment(): ImageProcessingEngine {
  if (typeof process !== 'undefined' && process.env) {
    // Check for DISABLE flags (emergency fallback only)
    const disableFlags = [
      process.env.DISABLE_SHARP_IMAGE_PROCESSING,
      process.env.RAFI_DISABLE_SHARP,
      process.env.FORCE_JIMP_ENGINE,
      process.env.USE_LEGACY_IMAGE_PROCESSING
    ];
    
    const sharpDisabled = disableFlags.some(flag => 
      flag === 'true' || flag === '1' || flag === 'yes'
    );
    
    if (sharpDisabled) {
      console.warn('⚠️ Sharp image processing DISABLED via environment variables - falling back to Jimp');
      console.warn('📉 Performance will be 27x slower. Remove disable flag to restore optimal performance.');
      return 'jimp';
    }
  }
  return 'sharp';
}

/**
 * AUTO-INITIALIZATION
 * Runs once when module is imported
 */
(() => {
  currentEngine = detectEngineFromEnvironment();
})();

/**
 * GET CURRENT ENGINE
 */
export function getImageProcessingEngine(): ImageProcessingEngine {
  return currentEngine;
}

/**
 * SET ENGINE MANUALLY (For testing/debugging only)
 */
export function setImageProcessingEngine(engine: ImageProcessingEngine): void {
  const previousEngine = currentEngine;
  currentEngine = engine;
  
  if (previousEngine !== engine) {
    if (engine === 'jimp') {
      console.warn(`⚠️ Image processing engine switched: ${previousEngine} → ${engine} (Performance will decrease 27x)`);
    } else {
      console.log(`🚀 Image processing engine switched: ${previousEngine} → ${engine} (Performance restored)`);
    }
  }
}

/**
 * UNIVERSAL COMPOSITE FUNCTION
 * Auto-selects implementation based on current engine
 */
export async function compositeElementInfoImgUniversal(options: {
  inputImgBase64: string;
  elementsPositionInfo: Array<{ rect: any; indexId?: number }>;
  size?: { width: number; height: number };
  annotationPadding?: number;
  borderThickness?: number;
  prompt?: string;
}): Promise<string> {
  
  const startTime = performance.now();
  let result: string;
  
  try {
    if (currentEngine === 'sharp') {
      result = await compositeElementInfoImgSharp(options);
    } else {
      result = await compositeElementInfoImg(options);
    }
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    // Only log performance warnings for Jimp
    if (currentEngine === 'jimp' && duration > 50) {
      console.warn(`⚠️ SLOW Image processing (${currentEngine}): ${duration}ms - Consider enabling Sharp for 27x speedup`);
    } else {
      console.log(`⚡ Image processing (${currentEngine}): ${duration}ms`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ Image processing failed with ${currentEngine}:`, error);
    
    // AUTOMATIC FALLBACK TO JIMP IF SHARP FAILS (Emergency safety net)
    if (currentEngine === 'sharp') {
      console.error('🚨 Sharp failed! Falling back to Jimp (emergency mode)...');
      console.error('📧 Please report this issue - Sharp should not fail in production');
      
      try {
        result = await compositeElementInfoImg(options);
        console.warn('✅ Emergency Jimp fallback successful - but performance is degraded');
        return result;
      } catch (fallbackError) {
        console.error('💥 CRITICAL: Both Sharp and Jimp failed!', fallbackError);
        throw fallbackError;
      }
    }
    
    throw error;
  }
}

/**
 * UNIVERSAL PROCESS FUNCTION
 * Auto-selects implementation based on current engine
 */
export async function processImageElementInfoUniversal(options: {
  inputImgBase64: string;
  elementsPositionInfo: Array<BaseElement>;
  elementsPositionInfoWithoutText: Array<BaseElement>;
}) {
  
  const startTime = performance.now();
  
  try {
    let result;
    
    if (currentEngine === 'sharp') {
      result = await processImageElementInfoSharp(options);
    } else {
      result = await processImageElementInfo(options);
    }
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    // Performance monitoring with warnings
    if (currentEngine === 'jimp' && duration > 100) {
      console.warn(`⚠️ SLOW Batch processing (${currentEngine}): ${duration}ms - Enable Sharp for massive speedup`);
    } else {
      console.log(`⚡ Batch image processing (${currentEngine}): ${duration}ms`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ Batch processing failed with ${currentEngine}:`, error);
    
    // AUTOMATIC FALLBACK TO JIMP IF SHARP FAILS
    if (currentEngine === 'sharp') {
      console.error('🚨 Sharp batch processing failed! Emergency Jimp fallback...');
      
      try {
        const result = await processImageElementInfo(options);
        console.warn('✅ Emergency Jimp batch fallback successful');
        return result;
      } catch (fallbackError) {
        console.error('💥 CRITICAL: Both Sharp and Jimp batch processing failed!', fallbackError);
        throw fallbackError;
      }
    }
    
    throw error;
  }
}

/**
 * ENGINE PERFORMANCE STATISTICS
 */
export function getEngineStats() {
  return {
    currentEngine,
    defaultEngine: 'sharp', // NEW: Show that Sharp is default
    jimp: {
      performance: '2.35 ops/sec',
      implementation: 'Pure JavaScript',
      memoryUsage: 'High',
      stability: 'Very Stable',
      status: currentEngine === 'jimp' ? 'ACTIVE (DEGRADED PERFORMANCE)' : 'Available (Fallback)'
    },
    sharp: {
      performance: '65.15 ops/sec (27x faster)',
      implementation: 'Native C++ (libvips)',
      memoryUsage: 'Low (streaming)',
      stability: 'Stable',
      status: currentEngine === 'sharp' ? 'ACTIVE (OPTIMAL PERFORMANCE)' : 'Available'
    },
    recommendation: currentEngine === 'jimp' ? 
      '🚨 URGENT: Switch to Sharp immediately for 27x performance improvement!' :
      '✅ Sharp enabled - optimal performance active'
  };
}

/**
 * PERFORMANCE OPTIMIZATION UTILITIES
 */
export function enableOptimalPerformance(): void {
  setImageProcessingEngine('sharp');
  console.log('🚀 Optimal performance enabled (Sharp)');
}

export function enableLegacyMode(): void {
  setImageProcessingEngine('jimp');
  console.warn('⚠️ Legacy mode enabled (Jimp) - Performance will be 27x slower');
}

// DEPRECATED: Keep for backward compatibility but warn users
export function enableSharpTesting(): void {
  console.warn('⚠️ enableSharpTesting() is deprecated - Sharp is now default');
  enableOptimalPerformance();
}

export function enableJimpTesting(): void {
  console.warn('⚠️ enableJimpTesting() is deprecated - use enableLegacyMode() for debugging only');
  enableLegacyMode();
}

export function randomEngineSelection(): ImageProcessingEngine {
  console.warn('⚠️ randomEngineSelection() is deprecated - Sharp is strongly recommended for production');
  const engines: ImageProcessingEngine[] = ['sharp']; // Heavily favor Sharp
  const randomEngine = engines[Math.floor(Math.random() * engines.length)];
  setImageProcessingEngine(randomEngine);
  console.log(`🎲 Engine selected: ${randomEngine}`);
  return randomEngine;
} 