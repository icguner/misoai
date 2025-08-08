import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { type Point, type Size, getAIConfig } from 'rfi-ai-core';
import type { PageType } from 'rfi-ai-core';
import { getTmpFile, sleep } from 'rfi-ai-core/utils';
import { MIDSCENE_ANDROID_IME_STRATEGY } from 'rfi-ai-shared/env';
import type { ElementInfo } from 'rfi-ai-shared/extractor';
import { isValidPNGImageBuffer, resizeImg } from 'rfi-ai-shared/img';
import { getDebug } from 'rfi-ai-shared/logger';
import { repeat } from 'rfi-ai-shared/utils';
import type { AndroidDeviceInputOpt, AndroidDevicePage } from 'rfi-ai-web';
import { remote } from 'webdriverio';

const androidScreenshotPath = '/data/local/tmp/midscene_screenshot.png';
// only for Android, because it's impossible to scroll to the bottom, so we need to set a default scroll times
const defaultScrollUntilTimes = 10;
const defaultFastScrollDuration = 100;
const defaultNormalScrollDuration = 1000;

export const debugPage = getDebug('android:device');
export type AndroidDeviceOpt = {
  imeStrategy?: 'webdriverio-only' | 'prefer-webdriverio';
  // WebDriverIO specific options
  capabilities?: any;
  hostname?: string;
  port?: number;
  protocol?: 'http' | 'https';
  path?: string;
} & AndroidDeviceInputOpt;

export class AndroidDevice implements AndroidDevicePage {
  private deviceId: string;
  private screenSize: Size | null = null;
  private deviceRatio = 1;
  private driver: any = null;
  private connectingDriver: Promise<any> | null = null;
  private destroyed = false;
  pageType: PageType = 'android';
  uri: string | undefined;
  options?: AndroidDeviceOpt;

  constructor(deviceId: string, options?: AndroidDeviceOpt) {
    assert(deviceId, 'deviceId is required for AndroidDevice');

    this.deviceId = deviceId;
    this.options = options;
  }

  /**
   * Connects to the Appium server and starts a session
   */
  public async connect(): Promise<any> {
    if (this.driver) {
      debugPage('Already connected to Appium server');
      return this.driver;
    }

    try {
      const defaultPort = 4723;
      const defaultHost = '127.0.0.1';

      debugPage(
        'Connecting to Appium server at %s://%s:%d%s',
        this.options?.protocol || 'http',
        this.options?.hostname || defaultHost,
        this.options?.port || defaultPort,
        this.options?.path || '/wd/hub',
      );

      const options = {
        hostname: this.options?.hostname || defaultHost,
        port: this.options?.port || defaultPort,
        path: this.options?.path || '/wd/hub',
        protocol: this.options?.protocol || 'http',
        capabilities: this.options?.capabilities,
        logLevel: 'info' as const,
        connectionRetryTimeout: 120000,
        connectionRetryCount: 3,
      };

      debugPage(
        'Starting Appium session with capabilities: %O',
        this.options?.capabilities,
      );
      this.driver = await remote(options);
      debugPage(
        'Successfully connected to Appium server, session ID: %s',
        this.driver.sessionId,
      );

      const size = await this.getScreenSize();
      console.log(`
DeviceId: ${this.deviceId}
ScreenSize:
${Object.keys(size)
  .filter((key) => size[key as keyof typeof size])
  .map(
    (key) =>
      `  ${key} size: ${size[key as keyof typeof size]}${key === 'override' && size[key as keyof typeof size] ? ' ✅' : ''}`,
  )
  .join('\n')}
`);
      debugPage('WebDriverIO initialized successfully');
      return this.driver;
    } catch (error: any) {
      debugPage('Failed to connect to Appium server: %s', error.message);
      throw new Error(`Failed to connect to Appium server: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Disconnects from the Appium server and ends the session
   */
  public async disconnect(): Promise<void> {
    if (!this.driver) {
      debugPage('No active Appium session to disconnect');
      return;
    }

    try {
      debugPage('Ending Appium session');

      // Check if this is a Sauce Labs session by examining the server hostname
      const isSauceLabs = this.options?.hostname?.includes('saucelabs.com');

      if (isSauceLabs) {
        // For Sauce Labs, we need to ensure proper session termination
        debugPage('Detected Sauce Labs session, ensuring proper termination');

        try {
          // First try to execute a custom script to set test status if possible
          // This helps with proper reporting in Sauce Labs dashboard
          await this.driver.executeScript('sauce:job-result', [
            {
              passed: true,
            },
          ]);
        } catch (e) {
          // Ignore errors from this command as it's optional
          debugPage(
            'Could not set Sauce Labs job result: %s',
            (e as Error).message,
          );
        }

        // Then delete the session
        await this.driver.deleteSession();
      } else {
        // For regular Appium sessions, use deleteSession()
        await this.driver.deleteSession();
      }

      this.driver = null;
      debugPage('Successfully ended Appium session');
    } catch (error: any) {
      debugPage('Error ending Appium session: %s', error.message);
      throw new Error(`Failed to end Appium session: ${error.message}`, {
        cause: error,
      });
    }
  }

  public async getDriver(): Promise<any> {
    if (this.destroyed) {
      throw new Error(
        `AndroidDevice ${this.deviceId} has been destroyed and cannot execute WebDriverIO commands`,
      );
    }

    // if already has WebDriverIO instance, return it
    if (this.driver) {
      return this.driver;
    }

    // If already connecting, wait for connection to complete
    if (this.connectingDriver) {
      return this.connectingDriver;
    }

    // Create new connection Promise
    this.connectingDriver = (async () => {
      let error: Error | null = null;
      debugPage(`Initializing WebDriverIO with device ID: ${this.deviceId}`);

      try {
        await this.connect();
        return this.driver;
      } catch (e) {
        debugPage(`Failed to initialize WebDriverIO: ${e}`);
        error = new Error(`Unable to connect to device ${this.deviceId}: ${e}`);
      } finally {
        this.connectingDriver = null;
      }

      if (error) {
        throw error;
      }

      throw new Error('WebDriverIO initialization failed unexpectedly');
    })();

    return this.connectingDriver;
  }

  public async launch(uri: string): Promise<AndroidDevice> {
    const driver = await this.getDriver();
    this.uri = uri;

    try {
      if (
        uri.startsWith('http://') ||
        uri.startsWith('https://') ||
        uri.includes('://')
      ) {
        // If it's a URI with scheme
        await driver.url(uri);
      } else if (uri.includes('/')) {
        // If it's in format like 'com.android/settings.Settings'
        const [appPackage, appActivity] = uri.split('/');
        await driver.startActivity(appPackage, appActivity);
      } else {
        // Assume it's just a package name
        await driver.activateApp(uri);
      }
      debugPage(`Successfully launched: ${uri}`);
    } catch (error: any) {
      debugPage(`Error launching ${uri}: ${error}`);
      throw new Error(`Failed to launch ${uri}: ${error.message}`, {
        cause: error,
      });
    }

    return this;
  }

  // @deprecated
  async getElementsInfo(): Promise<ElementInfo[]> {
    return [];
  }

  async getElementsNodeTree(): Promise<any> {
    // Get Android XML DOM structure via Appium
    try {
      if (this.driver) {
        const pageSource = await this.driver.getPageSource();
        // Return simplified structure for now
        return {
          node: { xml: pageSource },
          children: [],
        };
      }
    } catch (error) {
      debugPage('Failed to get page source: %s', (error as Error).message);
    }
    
    // Fallback to empty tree
    return {
      node: null,
      children: [],
    };
  }

  // APPIUM NATIVE SELECTOR METHODS for direct flow
  async clickBySelector(selector: string): Promise<void> {
    debugPage('[APPIUM-CLICK] Attempting to click selector: %s', selector);
    
    if (!this.driver) {
      await this.getDriver();
    }
    
    try {
      let element;
      
      // Handle different selector types
      if (selector.startsWith('id:')) {
        // Resource ID selector
        const resourceId = selector.substring(3);
        element = await this.driver.$(`android=new UiSelector().resourceId("${resourceId}")`);
      } else if (selector.startsWith('~')) {
        // Accessibility ID selector
        const accessibilityId = selector.substring(1);
        element = await this.driver.$(`~${accessibilityId}`);
      } else if (selector.startsWith('//')) {
        // XPath selector
        element = await this.driver.$(selector);
      } else if (selector.includes('@text=')) {
        // Text-based selector
        element = await this.driver.$(selector);
      } else {
        // Default to XPath
        element = await this.driver.$(selector);
      }
      
      if (element && await element.isExisting()) {
        await element.click();
        debugPage('[APPIUM-CLICK] Successfully clicked: %s', selector);
        return;
      }
      
      throw new Error(`Element not found for selector: ${selector}`);
    } catch (error) {
      debugPage('[APPIUM-CLICK] Failed to click %s: %s', selector, (error as Error).message);
      throw error;
    }
  }

  async typeBySelector(selector: string, text: string): Promise<void> {
    debugPage('[APPIUM-TYPE] Attempting to type in selector: %s', selector);
    
    if (!this.driver) {
      await this.getDriver();
    }
    
    try {
      let element;
      
      // Handle different selector types (same as clickBySelector)
      if (selector.startsWith('id:')) {
        const resourceId = selector.substring(3);
        element = await this.driver.$(`android=new UiSelector().resourceId("${resourceId}")`);
      } else if (selector.startsWith('~')) {
        const accessibilityId = selector.substring(1);
        element = await this.driver.$(`~${accessibilityId}`);
      } else if (selector.startsWith('//')) {
        element = await this.driver.$(selector);
      } else {
        element = await this.driver.$(selector);
      }
      
      if (element && await element.isExisting()) {
        await element.clearValue();
        await element.setValue(text);
        debugPage('[APPIUM-TYPE] Successfully typed: %s', text);
        return;
      }
      
      throw new Error(`Element not found for selector: ${selector}`);
    } catch (error) {
      debugPage('[APPIUM-TYPE] Failed to type in %s: %s', selector, (error as Error).message);
      throw error;
    }
  }

  async clearBySelector(selector: string): Promise<void> {
    debugPage('[APPIUM-CLEAR] Attempting to clear selector: %s', selector);
    
    if (!this.driver) {
      await this.getDriver();
    }
    
    try {
      let element;
      
      if (selector.startsWith('id:')) {
        const resourceId = selector.substring(3);
        element = await this.driver.$(`android=new UiSelector().resourceId("${resourceId}")`);
      } else if (selector.startsWith('~')) {
        const accessibilityId = selector.substring(1);
        element = await this.driver.$(`~${accessibilityId}`);
      } else {
        element = await this.driver.$(selector);
      }
      
      if (element && await element.isExisting()) {
        await element.clearValue();
        debugPage('[APPIUM-CLEAR] Successfully cleared: %s', selector);
        return;
      }
      
      throw new Error(`Element not found for selector: ${selector}`);
    } catch (error) {
      debugPage('[APPIUM-CLEAR] Failed to clear %s: %s', selector, (error as Error).message);
      throw error;
    }
  }

  async scrollToSelector(selector: string): Promise<void> {
    debugPage('[APPIUM-SCROLL] Attempting to scroll to selector: %s', selector);
    
    if (!this.driver) {
      await this.getDriver();
    }
    
    try {
      let element;
      
      // Handle different selector types
      if (selector.startsWith('id:')) {
        const resourceId = selector.substring(3);
        element = await this.driver.$(`android=new UiSelector().resourceId("${resourceId}").scrollable(true)`);
        if (!element || !await element.isExisting()) {
          // Try without scrollable constraint
          element = await this.driver.$(`android=new UiSelector().resourceId("${resourceId}")`);
        }
      } else if (selector.startsWith('~')) {
        const accessibilityId = selector.substring(1);
        element = await this.driver.$(`~${accessibilityId}`);
      } else if (selector.startsWith('//')) {
        element = await this.driver.$(selector);
      } else {
        element = await this.driver.$(selector);
      }
      
      if (element && await element.isExisting()) {
        // Try to scroll element into view
        try {
          // Method 1: Using scrollIntoView if element supports it
          await element.scrollIntoView();
          debugPage('[APPIUM-SCROLL] Successfully scrolled to element using scrollIntoView');
        } catch (err) {
          // Method 2: Use UiScrollable to find and scroll to element
          try {
            const scrollableSelector = 'new UiScrollable(new UiSelector().scrollable(true).instance(0))';
            if (selector.startsWith('id:')) {
              const resourceId = selector.substring(3);
              await this.driver.$(`android=${scrollableSelector}.scrollIntoView(new UiSelector().resourceId("${resourceId}"))`);
            } else if (selector.includes('@text=')) {
              const textMatch = selector.match(/@text=["']([^"']+)["']/)?.[1];
              if (textMatch) {
                await this.driver.$(`android=${scrollableSelector}.scrollIntoView(new UiSelector().text("${textMatch}"))`);
              }
            }
            debugPage('[APPIUM-SCROLL] Successfully scrolled using UiScrollable');
          } catch (scrollErr) {
            debugPage('[APPIUM-SCROLL] Could not scroll to element: %s', (scrollErr as Error).message);
            // Element exists but couldn't scroll to it - not a critical error
          }
        }
        return;
      }
      
      throw new Error(`Element not found for selector: ${selector}`);
    } catch (error) {
      debugPage('[APPIUM-SCROLL] Failed to scroll to %s: %s', selector, (error as Error).message);
      throw error;
    }
  }

  private async getScreenSize(): Promise<{
    override: string;
    physical: string;
    orientation: number; // 0=portrait, 1=landscape, 2=reverse portrait, 3=reverse landscape
  }> {
    const driver = await this.getDriver();
    
    // Get window size using WebDriverIO API
    const windowSize = await driver.getWindowSize();
    const orientation = await driver.getOrientation();
    
    // Convert WebDriverIO orientation to Android orientation values
    const orientationMap: Record<string, number> = {
      'PORTRAIT': 0,
      'LANDSCAPE': 1,
      'PORTRAIT_UPSIDE_DOWN': 2,
      'LANDSCAPE_LEFT': 3
    };

    const size = {
      override: `${windowSize.width}x${windowSize.height}`,
      physical: `${windowSize.width}x${windowSize.height}`,
      orientation: orientationMap[orientation] || 0
    };

    debugPage(`Using screen size: ${size.override}, orientation: ${size.orientation}`);
    
    return size;
  }

  async size(): Promise<Size> {
    if (this.screenSize) {
      return this.screenSize;
    }

    const driver = await this.getDriver();

    // Use WebDriverIO getWindowSize method
    const windowSize = await driver.getWindowSize();
    const orientation = await driver.getOrientation();
    
    // Get device display density (using default ratio for now)
    this.deviceRatio = 1; // WebDriverIO handles density automatically

    this.screenSize = {
      width: windowSize.width,
      height: windowSize.height,
    };

    return this.screenSize;
  }

  async screenshotBase64(): Promise<string> {
    debugPage('screenshotBase64 begin');
    const { width, height } = await this.size();
    const driver = await this.getDriver();
    let screenshotBuffer;

    try {
      const screenshotBase64 = await driver.takeScreenshot();
      screenshotBuffer = Buffer.from(screenshotBase64, 'base64');

      // make sure screenshotBuffer is not null
      if (!screenshotBuffer) {
        throw new Error(
          'Failed to capture screenshot: screenshotBuffer is null',
        );
      }

      // check if the buffer is a valid PNG image, it might be a error string
      if (!isValidPNGImageBuffer(screenshotBuffer)) {
        debugPage('Invalid image buffer detected: not a valid image format');
        throw new Error(
          'Screenshot buffer has invalid format: could not find valid image signature',
        );
      }
    } catch (error) {
      const screenshotPath = getTmpFile('png')!;

      try {
        // Take a screenshot using WebDriverIO mobile command
        await driver.execute('mobile: shell', {
          command: 'screencap',
          args: ['-p', androidScreenshotPath]
        });
      } catch (error) {
        // Fallback screenshot method if mobile shell fails
        throw new Error('Unable to take screenshot using available methods');
      }

      await driver.execute('mobile: pullFile', {
        remotePath: androidScreenshotPath,
        localPath: screenshotPath
      });
      screenshotBuffer = await fs.promises.readFile(screenshotPath);
    }

    const resizedScreenshotBuffer = await resizeImg(screenshotBuffer, {
      width,
      height,
    });

    const result = `data:image/jpeg;base64,${resizedScreenshotBuffer.toString('base64')}`;
    debugPage('screenshotBase64 end');
    return result;
  }

  private adjustCoordinates(x: number, y: number): { x: number; y: number } {
    const ratio = this.deviceRatio;
    return {
      x: Math.round(x * ratio),
      y: Math.round(y * ratio),
    };
  }

  private reverseAdjustCoordinates(
    x: number,
    y: number,
  ): { x: number; y: number } {
    const ratio = this.deviceRatio;
    return {
      x: Math.round(x / ratio),
      y: Math.round(y / ratio),
    };
  }

  get mouse() {
    return {
      click: (x: number, y: number) => this.mouseClick(x, y),
      wheel: async (deltaX: number, deltaY: number) => {
        // Use modern scroll methods instead of deprecated mouseWheel
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          // Vertical scroll
          if (deltaY > 0) {
            await this.scrollDown();
          } else {
            await this.scrollUp();
          }
        } else {
          // Horizontal scroll
          if (deltaX > 0) {
            await this.scrollRight();
          } else {
            await this.scrollLeft();
          }
        }
      },
      move: (x: number, y: number) => this.mouseMove(x, y),
      drag: (from: { x: number; y: number }, to: { x: number; y: number }) =>
        this.swipe(from.x, from.y, to.x, to.y),
    };
  }

  get keyboard() {
    return {
      type: (text: string, options?: AndroidDeviceInputOpt) =>
        this.keyboardType(text, options),
      press: (
        action:
          | { key: string; command?: string }
          | { key: string; command?: string }[],
      ) => this.keyboardPressAction(action),
    };
  }

  async clearInput(element: ElementInfo): Promise<void> {
    if (!element) {
      return;
    }

    const driver = await this.getDriver();

    await this.mouse.click(element.center[0], element.center[1]);

    // Try to clear using WebDriverIO methods first
    try {
      // Select all text and delete
      await driver.sendKeys(['Meta', 'a']); // Ctrl+A equivalent on Android
      await driver.sendKeys('Delete');
    } catch (error) {
      // Fallback: Click multiple times on backspace
      debugPage('Standard clear failed, using backspace fallback');
      for (let i = 0; i < 50; i++) {
        await driver.pressKeyCode(67); // Backspace key code
      }
    }

    if (await driver.isKeyboardShown()) {
      return;
    }

    await this.mouse.click(element.center[0], element.center[1]);
  }

  async url(): Promise<string> {
    return '';
  }

  async scrollUntilTop(startPoint?: Point): Promise<void> {
    if (startPoint) {
      const startX = startPoint.left;
      const startY = startPoint.top;
      const endX = startX;
      const endY = 0;

      await this.swipe(startX, startY, endX, endY, 1200);
      return;
    }

    // Perform multiple fast scrolls to reach top
    await repeat(defaultScrollUntilTimes, async () => {
      const { width, height } = await this.size();
      await this.swipe(width / 2, height * 0.8, width / 2, height * 0.1, defaultFastScrollDuration);
    });
    await sleep(1000);
  }

  async scrollUntilBottom(startPoint?: Point): Promise<void> {
    if (startPoint) {
      const { height } = await this.size();
      const startX = startPoint.left;
      const startY = startPoint.top;
      const endX = startX;
      const endY = height;
      
      await this.swipe(startX, startY, endX, endY, 1200);
      return;
    }

    // Perform multiple fast scrolls to reach bottom
    await repeat(defaultScrollUntilTimes, async () => {
      const { width, height } = await this.size();
      await this.swipe(width / 2, height * 0.2, width / 2, height * 0.9, defaultFastScrollDuration);
    });
    await sleep(1000);
  }

  async scrollUntilLeft(startPoint?: Point): Promise<void> {
    if (startPoint) {
      const startX = startPoint.left;
      const startY = startPoint.top;
      const endX = 0;
      const endY = startY;
      
      await this.swipe(startX, startY, endX, endY, 1200);
      return;
    }

    // Perform multiple fast scrolls to reach left
    await repeat(defaultScrollUntilTimes, async () => {
      const { width, height } = await this.size();
      await this.swipe(width * 0.8, height / 2, width * 0.1, height / 2, defaultFastScrollDuration);
    });
    await sleep(1000);
  }

  async scrollUntilRight(startPoint?: Point): Promise<void> {
    if (startPoint) {
      const { width } = await this.size();
      const startX = startPoint.left;
      const startY = startPoint.top;
      const endX = width;
      const endY = startY;
      
      await this.swipe(startX, startY, endX, endY, 1200);
      return;
    }

    // Perform multiple fast scrolls to reach right
    await repeat(defaultScrollUntilTimes, async () => {
      const { width, height } = await this.size();
      await this.swipe(width * 0.2, height / 2, width * 0.9, height / 2, defaultFastScrollDuration);
    });
    await sleep(1000);
  }

  async scrollUp(distance?: number, startPoint?: Point): Promise<void> {
    const { width, height } = await this.size();
    
    // Default scroll distance is 70% of screen height for Android
    const scrollDistance = distance || Math.floor(height * 0.7);

    if (startPoint) {
      const startX = startPoint.left;
      const startY = startPoint.top;
      const endX = startX;
      const endY = Math.min(height, startY + scrollDistance);
      
      await this.swipe(startX, startY, endX, endY);
      return;
    }

    // Default scroll from center-top to center-bottom (swipe down to scroll up)
    const startX = width / 2;
    const startY = height * 0.2;
    const endX = startX;
    const endY = Math.min(height * 0.8, startY + scrollDistance);
    
    await this.swipe(startX, startY, endX, endY);
  }

  async scrollDown(distance?: number, startPoint?: Point): Promise<void> {
    const { width, height } = await this.size();
    
    // Default scroll distance is 70% of screen height for Android
    const scrollDistance = distance || Math.floor(height * 0.7);

    if (startPoint) {
      const startX = startPoint.left;
      const startY = startPoint.top;
      const endX = startX;
      const endY = Math.max(0, startY - scrollDistance);
      
      await this.swipe(startX, startY, endX, endY);
      return;
    }

    // Default scroll from center-bottom to center-top (swipe up to scroll down)
    const startX = width / 2;
    const startY = height * 0.8;
    const endX = startX;
    const endY = Math.max(height * 0.2, startY - scrollDistance);
    
    await this.swipe(startX, startY, endX, endY);
  }

  async scrollLeft(distance?: number, startPoint?: Point): Promise<void> {
    const { width, height } = await this.size();
    
    // Default scroll distance is 70% of screen width for Android
    const scrollDistance = distance || Math.floor(width * 0.7);

    if (startPoint) {
      const startX = startPoint.left;
      const startY = startPoint.top;
      const endX = Math.max(0, startX - scrollDistance);
      const endY = startY;
      
      await this.swipe(startX, startY, endX, endY);
      return;
    }

    // Default scroll from center-right to center-left
    const startX = width * 0.8;
    const startY = height / 2;
    const endX = Math.max(width * 0.2, startX - scrollDistance);
    const endY = startY;
    
    await this.swipe(startX, startY, endX, endY);
  }

  async scrollRight(distance?: number, startPoint?: Point): Promise<void> {
    const { width, height } = await this.size();
    
    // Default scroll distance is 70% of screen width for Android
    const scrollDistance = distance || Math.floor(width * 0.7);

    if (startPoint) {
      const startX = startPoint.left;
      const startY = startPoint.top;
      const endX = Math.min(width, startX + scrollDistance);
      const endY = startY;
      
      await this.swipe(startX, startY, endX, endY);
      return;
    }

    // Default scroll from center-left to center-right
    const startX = width * 0.2;
    const startY = height / 2;
    const endX = Math.min(width * 0.8, startX + scrollDistance);
    const endY = startY;
    
    await this.swipe(startX, startY, endX, endY);
  }

  private async keyboardType(
    text: string,
    options?: AndroidDeviceInputOpt,
  ): Promise<void> {
    if (!text) return;
    const driver = await this.getDriver();
    const IME_STRATEGY =
      (this.options?.imeStrategy ||
        getAIConfig(MIDSCENE_ANDROID_IME_STRATEGY)) ??
      'webdriverio-only';
    const isAutoDismissKeyboard =
      options?.autoDismissKeyboard ?? this.options?.autoDismissKeyboard ?? true;

    // Use WebDriverIO sendKeys method
    await driver.sendKeys(text);

    if (isAutoDismissKeyboard === true) {
      await driver.hideKeyboard();
    }
  }

  private async keyboardPress(key: string): Promise<void> {
    // Map web keys to Android key codes (numbers)
    const keyCodeMap: Record<string, number> = {
      Enter: 66,
      Backspace: 67,
      Tab: 61,
      ArrowUp: 19,
      ArrowDown: 20,
      ArrowLeft: 21,
      ArrowRight: 22,
      Escape: 111,
      Home: 3,
      End: 123,
    };

    const driver = await this.getDriver();

    const keyCode = keyCodeMap[key];
    if (keyCode !== undefined) {
      await driver.pressKeyCode(keyCode);
    } else {
      // for keys not in the mapping table, try to get its ASCII code (if it's a single character)
      if (key.length === 1) {
        const asciiCode = key.toUpperCase().charCodeAt(0);
        // Android key codes, A-Z is 29-54
        if (asciiCode >= 65 && asciiCode <= 90) {
          await driver.pressKeyCode(asciiCode - 36); // 65-36=29 (A's key code)
        }
      }
    }
  }

  private async keyboardPressAction(
    action:
      | { key: string; command?: string }
      | { key: string; command?: string }[],
  ): Promise<void> {
    if (Array.isArray(action)) {
      for (const act of action) {
        await this.keyboardPress(act.key);
      }
    } else {
      await this.keyboardPress(action.key);
    }
  }

  private async mouseClick(x: number, y: number): Promise<void> {
    const driver = await this.getDriver();

    // Use adjusted coordinates and W3C Actions API
    const { x: adjustedX, y: adjustedY } = this.adjustCoordinates(x, y);
    
    await driver.performActions([
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', x: adjustedX, y: adjustedY, duration: 0 },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 50 },
          { type: 'pointerUp', button: 0 }
        ]
      }
    ]);

    // Release all actions
    await driver.releaseActions();
  }

  private async mouseMove(x: number, y: number): Promise<void> {
    // WebDriverIO doesn't have direct cursor movement functionality, but we can record the position for subsequent operations
    // This is a no-op, as WebDriverIO doesn't support direct mouse movement
    return Promise.resolve();
  }

  /**
   * @deprecated Use swipe() method instead for W3C Actions API compliance
   */
  private async mouseDrag(
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): Promise<void> {
    // Redirect to W3C-compliant swipe method
    await this.swipe(from.x, from.y, to.x, to.y);
  }

  async destroy(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    try {
      // Clean up Android-specific resources first
      if (this.driver) {
        await this.driver.execute('mobile: shell', {
          command: 'rm',
          args: ['-f', androidScreenshotPath]
        });
      }

      // Use the new disconnect method for proper session cleanup
      await this.disconnect();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }

    this.connectingDriver = null;
    this.screenSize = null;
  }

  async back(): Promise<void> {
    const driver = await this.getDriver();
    await driver.back();
  }

  async home(): Promise<void> {
    const driver = await this.getDriver();
    await driver.pressKeyCode(3);
  }

  async recentApps(): Promise<void> {
    const driver = await this.getDriver();
    await driver.pressKeyCode(82);
  }

  async getXpathsById(id: string): Promise<string[]> {
    throw new Error('Not implemented');
  }

  async getElementInfoByXpath(xpath: string): Promise<ElementInfo> {
    throw new Error('Not implemented');
  }

  /**
   * W3C Actions API - Tap at specific coordinates
   */
  async tap(x: number, y: number): Promise<void> {
    return this.mouseClick(x, y);
  }

  /**
   * W3C Actions API - Swipe from one point to another
   */
  async swipe(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    duration: number = 800
  ): Promise<void> {
    const driver = await this.getDriver();

    // Use adjusted coordinates
    const { x: adjustedStartX, y: adjustedStartY } = this.adjustCoordinates(startX, startY);
    const { x: adjustedEndX, y: adjustedEndY } = this.adjustCoordinates(endX, endY);

    // Use W3C Actions API instead of deprecated touchAction
    await driver.performActions([
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', x: adjustedStartX, y: adjustedStartY, duration: 0 },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 50 },
          { type: 'pointerMove', x: adjustedEndX, y: adjustedEndY, duration },
          { type: 'pointerUp', button: 0 }
        ]
      }
    ]);

    // Release all actions
    await driver.releaseActions();
  }
}