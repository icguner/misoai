import type { Point, Size } from 'misoai-core';

/**
 * Windows-specific configuration types
 */
export interface WindowsAutomationConfig {
  /** Screenshot capture method */
  screenshotMethod: 'robotjs' | 'nutjs' | 'screenshot-desktop' | 'win32-api';
  /** UI element detection method */
  elementDetection: 'ai-vision' | 'win32-uia' | 'accessibility-api';
  /** Window management approach */
  windowManagement: 'win32-api' | 'nutjs' | 'robotjs';
  /** Performance optimization settings */
  performance: {
    screenshotCaching: boolean;
    elementCaching: boolean;
    batchOperations: boolean;
  };
  /** Timeout settings */
  timeouts: {
    screenshot: number;
    elementSearch: number;
    windowOperation: number;
  };
}

/**
 * Windows application information
 */
export interface WindowsApplication {
  /** Process ID */
  pid: number;
  /** Application name */
  name: string;
  /** Window title */
  title: string;
  /** Executable path */
  executablePath: string;
  /** Window handle (HWND) */
  windowHandle: string;
  /** Application bounds */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Window state */
  state: 'normal' | 'minimized' | 'maximized' | 'hidden';
  /** Whether window is active/focused */
  isActive: boolean;
}

/**
 * Windows UI element information
 */
export interface WindowsUIElement {
  /** Element identifier */
  id: string;
  /** Element type (button, textbox, etc.) */
  type: string;
  /** Element name/title */
  name: string;
  /** Element bounds relative to screen */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Element center point */
  center: Point;
  /** Whether element is visible */
  visible: boolean;
  /** Whether element is enabled */
  enabled: boolean;
  /** Element text content */
  text?: string;
  /** Element value (for inputs) */
  value?: string;
  /** Automation ID (if available) */
  automationId?: string;
  /** Class name */
  className?: string;
  /** Control type */
  controlType?: string;
  /** Parent element reference */
  parent?: WindowsUIElement;
  /** Child elements */
  children?: WindowsUIElement[];
}

/**
 * Screenshot capture options
 */
export interface WindowsScreenshotOptions {
  /** Target window (if not specified, captures entire screen) */
  window?: WindowsApplication;
  /** Specific region to capture */
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Image format */
  format: 'png' | 'jpeg' | 'bmp';
  /** Image quality (for JPEG) */
  quality?: number;
  /** Whether to include cursor */
  includeCursor?: boolean;
}

/**
 * Window manipulation options
 */
export interface WindowManipulationOptions {
  /** Target position */
  position?: Point;
  /** Target size */
  size?: Size;
  /** Window state to set */
  state?: 'normal' | 'minimized' | 'maximized' | 'restore';
  /** Whether to bring window to front */
  bringToFront?: boolean;
  /** Whether to focus the window */
  focus?: boolean;
}

/**
 * Input simulation options
 */
export interface WindowsInputOptions {
  /** Delay between keystrokes (ms) */
  keystrokeDelay?: number;
  /** Delay between mouse movements (ms) */
  mouseDelay?: number;
  /** Whether to use hardware-level input simulation */
  useHardwareInput?: boolean;
  /** Modifier keys to hold during input */
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'win')[];
}

/**
 * Process monitoring options
 */
export interface ProcessMonitoringOptions {
  /** Process name or ID to monitor */
  target: string | number;
  /** Monitoring interval (ms) */
  interval?: number;
  /** Whether to monitor child processes */
  includeChildren?: boolean;
  /** Performance metrics to collect */
  metrics?: ('cpu' | 'memory' | 'handles' | 'threads')[];
}

/**
 * Windows automation capabilities
 */
export interface WindowsAutomationCapabilities {
  /** Supported screenshot methods */
  screenshotMethods: string[];
  /** Supported element detection methods */
  elementDetectionMethods: string[];
  /** Supported window management features */
  windowManagementFeatures: string[];
  /** Available input simulation methods */
  inputSimulationMethods: string[];
  /** System information */
  systemInfo: {
    osVersion: string;
    architecture: string;
    screenResolution: Size;
    dpiScaling: number;
  };
}

/**
 * Error types specific to Windows automation
 */
export interface WindowsAutomationError extends Error {
  code: 'WINDOW_NOT_FOUND' | 'ELEMENT_NOT_FOUND' | 'SCREENSHOT_FAILED' | 
        'INPUT_FAILED' | 'PERMISSION_DENIED' | 'AUTOMATION_DISABLED';
  details?: any;
}
