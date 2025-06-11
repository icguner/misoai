// Main exports for Windows automation package
export { WindowsAgent } from './agent/windows-agent';
export type { WindowsAgentOptions } from './agent/windows-agent';

export { WindowsPage } from './page/windows-page';

// Utility exports
export { WindowsScreenshotCapture } from './utils/screenshot';
export { WindowsElementDetector } from './utils/element-detector';
export { WindowsInputSimulator } from './utils/input-simulator';
export { WindowsWindowManager } from './utils/window-manager';

// Type exports
export type {
  WindowsAutomationConfig,
  WindowsApplication,
  WindowsUIElement,
  WindowsScreenshotOptions,
  WindowManipulationOptions,
  WindowsInputOptions,
  ProcessMonitoringOptions,
  WindowsAutomationCapabilities,
  WindowsAutomationError,
} from './types';

// Re-export core types for convenience
export type {
  MemoryItem,
  MemoryConfig,
  MemoryStats,
  AITaskResult,
  LocateOption,
} from 'misoai-core';

// Environment configuration
export { overrideAIConfig } from 'misoai-shared/env';

/**
 * Factory function to create a Windows agent
 */
export function createWindowsAgent(options?: {
  screenshotMethod?: 'robotjs' | 'nutjs' | 'screenshot-desktop' | 'win32-api';
  elementDetection?: 'ai-vision' | 'win32-uia' | 'accessibility-api';
  memoryEnabled?: boolean;
  aiActionContext?: string;
}) {
  return new WindowsAgent({
    windowsConfig: {
      screenshotMethod: options?.screenshotMethod || 'nutjs',
      elementDetection: options?.elementDetection || 'ai-vision',
      windowManagement: 'win32-api',
      performance: {
        screenshotCaching: true,
        elementCaching: true,
        batchOperations: true,
      },
      timeouts: {
        screenshot: 5000,
        elementSearch: 10000,
        windowOperation: 3000,
      },
    },
    memoryConfig: {
      maxItems: options?.memoryEnabled !== false ? 50 : 0,
      maxAge: 30 * 60 * 1000, // 30 minutes
      enablePersistence: options?.memoryEnabled !== false,
      enableAnalytics: true,
      filterStrategy: 'hybrid',
    },
    aiActionContext:
      options?.aiActionContext ||
      'You are automating a Windows desktop application. Pay attention to window controls, menus, and desktop elements.',
  });
}

/**
 * Factory function to create a Windows agent for a specific application
 */
export async function createWindowsAgentForApp(
  applicationIdentifier: string | number,
  options?: Parameters<typeof createWindowsAgent>[0],
) {
  const agent = createWindowsAgent(options);
  await agent.connectToApplication(applicationIdentifier);
  return agent;
}

/**
 * Factory function to launch and connect to a Windows application
 */
export async function launchWindowsApp(
  applicationPath: string,
  args?: string[],
  options?: Parameters<typeof createWindowsAgent>[0],
) {
  const agent = createWindowsAgent(options);
  await agent.launchApplication(applicationPath, args);
  return agent;
}
