export {
  imageInfo,
  imageInfoOfBase64,
  bufferFromBase64,
  base64Encoded,
  isValidPNGImageBuffer,
} from './info';

export {
  trimImage,
  resizeImg,
  resizeImgBase64,
  transformImgPathToBase64,
  zoomForGPT4o,
  saveBase64Image,
  paddingToMatchBlock,
  paddingToMatchBlockByBase64,
  cropByRect,
  jimpFromBase64,
  jimpToBase64,
} from './transform';

export { processImageElementInfo, compositeElementInfoImg } from './box-select';

export { drawBoxOnImage, savePositionImg } from './draw-box';

// SHARP EXPORTS - Performance-optimized implementations
export { 
  processImageElementInfoSharp, 
  compositeElementInfoImgSharp,
  getSharpStats 
} from './sharp-box-select';

// ENGINE SELECTOR & PERFORMANCE OPTIMIZATION SYSTEM
export {
  getImageProcessingEngine,
  setImageProcessingEngine,
  compositeElementInfoImgUniversal,
  processImageElementInfoUniversal,
  getEngineStats,
  // New performance utilities
  enableOptimalPerformance,
  enableLegacyMode,
  // Deprecated but kept for compatibility
  enableSharpTesting,
  enableJimpTesting,
  randomEngineSelection,
  type ImageProcessingEngine
} from './engine-selector';
