import { getDebug } from 'misoai-shared/logger';
import type {
  WindowsApplication,
  WindowsAutomationConfig,
  WindowsScreenshotOptions,
} from '../types';

// Dynamic imports for optional dependencies
let robotjs: any;
let nutjs: any;
let screenshotDesktop: any;

const debugScreenshot = getDebug('windows:screenshot');

/**
 * Windows screenshot capture utility
 */
export class WindowsScreenshotCapture {
  private config: WindowsAutomationConfig;

  constructor(config: WindowsAutomationConfig) {
    this.config = config;
  }

  /**
   * Captures a screenshot using the configured method
   */
  public async capture(options: WindowsScreenshotOptions): Promise<string> {
    debugScreenshot(
      'Capturing screenshot with method: %s',
      this.config.screenshotMethod,
    );

    try {
      switch (this.config.screenshotMethod) {
        case 'robotjs':
          return await this.captureWithRobotJS(options);
        case 'nutjs':
          return await this.captureWithNutJS(options);
        case 'screenshot-desktop':
          return await this.captureWithScreenshotDesktop(options);
        case 'win32-api':
          return await this.captureWithWin32API(options);
        default:
          throw new Error(
            `Unsupported screenshot method: ${this.config.screenshotMethod}`,
          );
      }
    } catch (error: any) {
      debugScreenshot('Screenshot capture failed: %s', error.message);
      throw new Error(`Screenshot capture failed: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Captures screenshot using RobotJS
   */
  private async captureWithRobotJS(
    options: WindowsScreenshotOptions,
  ): Promise<string> {
    if (!robotjs) {
      try {
        robotjs = require('robotjs');
      } catch (error) {
        throw new Error(
          'RobotJS not available. Install with: npm install robotjs',
        );
      }
    }

    debugScreenshot('Capturing with RobotJS');

    try {
      let bitmap;

      if (options.region) {
        // Capture specific region
        bitmap = robotjs.screen.capture(
          options.region.x,
          options.region.y,
          options.region.width,
          options.region.height,
        );
      } else {
        // Capture entire screen
        bitmap = robotjs.screen.capture();
      }

      // Convert bitmap to base64
      const buffer = Buffer.from(bitmap.image, 'binary');
      return buffer.toString('base64');
    } catch (error: any) {
      throw new Error(`RobotJS screenshot failed: ${error.message}`);
    }
  }

  /**
   * Captures screenshot using Nut.js
   */
  private async captureWithNutJS(
    options: WindowsScreenshotOptions,
  ): Promise<string> {
    if (!nutjs) {
      try {
        nutjs = require('@nut-tree/nut-js');
      } catch (error) {
        throw new Error(
          'Nut.js not available. Install with: npm install @nut-tree/nut-js',
        );
      }
    }

    debugScreenshot('Capturing with Nut.js');

    try {
      let image;

      if (options.region) {
        // Capture specific region
        const region = new nutjs.Region(
          options.region.x,
          options.region.y,
          options.region.width,
          options.region.height,
        );
        image = await nutjs.screen.capture(region);
      } else {
        // Capture entire screen
        image = await nutjs.screen.capture();
      }

      // Convert to base64
      const buffer = await image.toBuffer();
      return buffer.toString('base64');
    } catch (error: any) {
      throw new Error(`Nut.js screenshot failed: ${error.message}`);
    }
  }

  /**
   * Captures screenshot using screenshot-desktop
   */
  private async captureWithScreenshotDesktop(
    options: WindowsScreenshotOptions,
  ): Promise<string> {
    if (!screenshotDesktop) {
      try {
        screenshotDesktop = require('screenshot-desktop');
      } catch (error) {
        throw new Error(
          'screenshot-desktop not available. Install with: npm install screenshot-desktop',
        );
      }
    }

    debugScreenshot('Capturing with screenshot-desktop');

    try {
      const screenshotOptions: any = {
        format: options.format || 'png',
      };

      if (options.region) {
        screenshotOptions.crop = {
          x: options.region.x,
          y: options.region.y,
          width: options.region.width,
          height: options.region.height,
        };
      }

      const buffer = await screenshotDesktop(screenshotOptions);
      return buffer.toString('base64');
    } catch (error: any) {
      throw new Error(`screenshot-desktop failed: ${error.message}`);
    }
  }

  /**
   * Captures screenshot using Win32 API (via FFI)
   */
  private async captureWithWin32API(
    options: WindowsScreenshotOptions,
  ): Promise<string> {
    debugScreenshot('Capturing with Win32 API');

    try {
      // This would require implementing Win32 API calls via node-ffi-napi
      // For now, fall back to RobotJS
      debugScreenshot('Win32 API not implemented, falling back to RobotJS');
      return await this.captureWithRobotJS(options);
    } catch (error: any) {
      throw new Error(`Win32 API screenshot failed: ${error.message}`);
    }
  }

  /**
   * Captures screenshot of a specific window
   */
  public async captureWindow(
    application: WindowsApplication,
    options?: Partial<WindowsScreenshotOptions>,
  ): Promise<string> {
    debugScreenshot('Capturing window screenshot for: %s', application.name);

    const windowOptions: WindowsScreenshotOptions = {
      format: 'png',
      includeCursor: false,
      window: application,
      region: {
        x: application.bounds.x,
        y: application.bounds.y,
        width: application.bounds.width,
        height: application.bounds.height,
      },
      ...options,
    };

    return await this.capture(windowOptions);
  }

  /**
   * Captures screenshot of the entire desktop
   */
  public async captureDesktop(
    options?: Partial<WindowsScreenshotOptions>,
  ): Promise<string> {
    debugScreenshot('Capturing desktop screenshot');

    const desktopOptions: WindowsScreenshotOptions = {
      format: 'png',
      includeCursor: false,
      ...options,
    };

    return await this.capture(desktopOptions);
  }

  /**
   * Gets available screenshot methods
   */
  public getAvailableMethods(): string[] {
    const methods: string[] = [];

    try {
      require('robotjs');
      methods.push('robotjs');
    } catch (e) {
      // RobotJS not available
    }

    try {
      require('@nut-tree/nut-js');
      methods.push('nutjs');
    } catch (e) {
      // Nut.js not available
    }

    try {
      require('screenshot-desktop');
      methods.push('screenshot-desktop');
    } catch (e) {
      // screenshot-desktop not available
    }

    // Win32 API would be checked here
    methods.push('win32-api');

    return methods;
  }
}
