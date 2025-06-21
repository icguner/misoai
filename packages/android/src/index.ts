export {
  AndroidAgent,
  AndroidDevice,
  AppiumDevice,
  agentFromAdbDevice,
  agentFromAppiumServer,
  agentFromLocalAppium,
  agentFromSauceLabs
} from './agent';

// Also export AndroidDevice from page for compatibility
export { AndroidDevice as AndroidDeviceBase } from './page';

export type {
  AppiumServerConfig,
  AppiumBaseCapabilities,
  SauceLabsConfig,
  SauceLabsCapabilities,
  SauceLabsSpecificOptions
} from './types';
export { overrideAIConfig } from 'rfi-ai-shared/env';

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
