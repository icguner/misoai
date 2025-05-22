export { AppiumDevice } from './page/appium-device';
export {
  AndroidAgent,
  agentFromAppiumServer,
  agentFromLocalAppium,
  agentFromSauceLabs
} from './agent';
export type {
  AppiumServerConfig,
  AppiumBaseCapabilities,
  SauceLabsConfig,
  SauceLabsCapabilities,
  SauceLabsSpecificOptions
} from './types';
export { overrideAIConfig } from 'misoai-shared/env';

// Performance monitoring exports
export {
  PerformanceMonitor,
  type CpuInfo,
  type MemoryInfo,
  type BatteryInfo,
  type NetworkInfo,
  type DeviceInfo,
  type PerformanceMetrics
} from './performance';

// Media utility exports
export {
  takeScreenshot,
  startVideoRecording,
  stopVideoRecording,
  type ScreenshotOptions,
  type VideoRecordingOptions
} from './utils/media';
