import { type ElementTreeNode, type Point, type Size } from 'misoai-core';
import type { PageType } from 'misoai-core';
import { NodeType } from 'misoai-shared/constants';
import type { ElementInfo } from 'misoai-shared/extractor';
import { getDebug } from 'misoai-shared/logger';
import type { AndroidDevicePage } from 'misoai-web';
import { remote } from 'webdriverio';
import type { AppiumBaseCapabilities, AppiumServerConfig } from '../types';

export const debugDevice = getDebug('android:appium-device');

/**
 * Implementation of AndroidDevicePage using Appium and WebdriverIO
 */
export class AppiumDevice implements AndroidDevicePage {
  /**
   * Page type identifier
   */
  pageType: PageType = 'android';

  /**
   * Current URI/URL of the device
   */
  uri: string | undefined;

  /**
   * WebdriverIO browser instance
   */
  private driver: WebdriverIO.Browser | null = null;

  /**
   * Appium server configuration
   */
  private serverConfig: AppiumServerConfig;

  /**
   * Appium capabilities
   */
  private capabilities: AppiumBaseCapabilities;

  /**
   * Screen size cache
   */
  private screenSize: Size | null = null;

  /**
   * Creates a new AppiumDevice instance
   *
   * @param serverConfig - Appium server configuration
   * @param capabilities - Appium capabilities
   */
  constructor(serverConfig: AppiumServerConfig, capabilities: AppiumBaseCapabilities) {
    this.serverConfig = serverConfig;
    this.capabilities = capabilities;
  }

  /**
   * Connects to the Appium server and starts a session
   */
  public async connect(): Promise<WebdriverIO.Browser> {
    if (this.driver) {
      debugDevice('Already connected to Appium server');
      return this.driver;
    }

    try {
      debugDevice('Connecting to Appium server at %s://%s:%d%s',
        this.serverConfig.protocol || 'http',
        this.serverConfig.hostname,
        this.serverConfig.port,
        this.serverConfig.path || '/wd/hub'
      );

      const options = {
        hostname: this.serverConfig.hostname,
        port: this.serverConfig.port,
        path: this.serverConfig.path || '/wd/hub',
        protocol: this.serverConfig.protocol || 'http',
        capabilities: this.capabilities,
        logLevel: 'info' as const,
        connectionRetryTimeout: 120000,
        connectionRetryCount: 3
      };

      debugDevice('Starting Appium session with capabilities: %O', this.capabilities);
      this.driver = await remote(options);
      debugDevice('Successfully connected to Appium server, session ID: %s', this.driver.sessionId);

      return this.driver;
    } catch (error: any) {
      debugDevice('Failed to connect to Appium server: %s', error.message);
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
      debugDevice('No active Appium session to disconnect');
      return;
    }

    try {
      debugDevice('Ending Appium session');

      // Check if this is a Sauce Labs session by examining the server hostname
      const isSauceLabs = this.serverConfig.hostname?.includes('saucelabs.com');

      if (isSauceLabs) {
        // For Sauce Labs, we need to ensure proper session termination
        debugDevice('Detected Sauce Labs session, ensuring proper termination');

        try {
          // First try to execute a custom script to set test status if possible
          // This helps with proper reporting in Sauce Labs dashboard
          await this.driver.executeScript('sauce:job-result', [{
            passed: true
          }]);
        } catch (e) {
          // Ignore errors from this command as it's optional
          debugDevice('Could not set Sauce Labs job result: %s', (e as Error).message);
        }

        // Then delete the session
        await this.driver.deleteSession();
      } else {
        // For regular Appium sessions, use deleteSession()
        await this.driver.deleteSession();
      }

      this.driver = null;
      debugDevice('Successfully ended Appium session');
    } catch (error: any) {
      debugDevice('Error ending Appium session: %s', error.message);
      throw new Error(`Failed to end Appium session: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Launches an app or opens a URL
   *
   * @param uri - App package, activity, or URL to launch
   */
  public async launch(uri: string): Promise<AppiumDevice> {
    const driver = await this.getDriver();
    this.uri = uri;

    try {
      if (uri.startsWith('http://') || uri.startsWith('https://') || uri.includes('://')) {
        // If it's a URI with scheme
        debugDevice('Opening URL: %s', uri);
        await driver.url(uri);
      } else if (uri.includes('/')) {
        // If it's in format like 'com.android/settings.Settings'
        const [appPackage, appActivity] = uri.split('/');
        debugDevice('Starting activity: %s/%s', appPackage, appActivity);
        await this.startActivity(appPackage, appActivity);
      } else {
        // Assume it's just a package name
        debugDevice('Activating app: %s', uri);
        await driver.activateApp(uri);
      }
      debugDevice('Successfully launched: %s', uri);
    } catch (error: any) {
      debugDevice('Error launching %s: %s', uri, error.message);
      throw new Error(`Failed to launch ${uri}: ${error.message}`, {
        cause: error,
      });
    }

    return this;
  }

  /**
   * Gets the WebdriverIO driver instance, connecting if necessary
   */
  private async getDriver(): Promise<WebdriverIO.Browser> {
    if (!this.driver) {
      await this.connect();
    }

    if (!this.driver) {
      throw new Error('Failed to initialize WebdriverIO driver');
    }

    return this.driver;
  }

  /**
   * Takes a screenshot and returns it as a base64-encoded string
   */
  public async screenshotBase64(): Promise<string> {
    debugDevice('Taking screenshot');
    const driver = await this.getDriver();

    try {
      const screenshot = await driver.takeScreenshot();
      return `data:image/png;base64,${screenshot}`;
    } catch (error: any) {
      debugDevice('Error taking screenshot: %s', error.message);
      throw new Error(`Failed to take screenshot: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Gets the element tree for the current screen
   * @returns Promise resolving to the element tree
   */
  public async getElementsNodeTree(): Promise<ElementTreeNode<ElementInfo>> {
    debugDevice('Getting element tree');
    const driver = await this.getDriver();

    try {
      // Get the page source (XML for Android)
      await driver.getPageSource(); // Just to ensure we can get the page source

      // TODO: Implement proper XML parsing and element tree construction
      // This is a placeholder implementation
      const rootElement: ElementInfo = {
        id: 'root',
        indexId: 0,
        nodeHashId: 'root',
        locator: '/',
        attributes: {
          nodeType: NodeType.CONTAINER,
        },
        nodeType: NodeType.CONTAINER,
        content: 'Root Element',
        rect: { left: 0, top: 0, width: 0, height: 0 },
        center: [0, 0]
      };

      return {
        node: rootElement,
        children: []
      };
    } catch (error: any) {
      debugDevice('Error getting element tree: %s', error.message);
      throw new Error(`Failed to get element tree: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Gets the current URL
   */
  public async url(): Promise<string> {
    try {
      const driver = await this.getDriver();
      const currentPackage = await driver.getCurrentPackage();
      const currentActivity = await driver.getCurrentActivity();
      return `${currentPackage}/${currentActivity}`;
    } catch (error: any) {
      debugDevice('Error getting URL: %s', error.message);
      return '';
    }
  }

  /**
   * Gets the screen size
   */
  public async size(): Promise<Size> {
    if (this.screenSize) {
      return this.screenSize;
    }

    try {
      const driver = await this.getDriver();
      const { width, height } = await driver.getWindowSize();
      this.screenSize = { width, height };
      return this.screenSize;
    } catch (error: any) {
      debugDevice('Error getting screen size: %s', error.message);
      throw new Error(`Failed to get screen size: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Starts an activity
   *
   * @param appPackage - Package name
   * @param appActivity - Activity name
   * @param opts - Additional options
   */
  public async startActivity(appPackage: string, appActivity: string, opts?: string): Promise<void> {
    debugDevice('Starting activity: %s/%s', appPackage, appActivity);
    const driver = await this.getDriver();

    try {
      await driver.startActivity(appPackage, appActivity, opts);
      debugDevice('Successfully started activity: %s/%s', appPackage, appActivity);
    } catch (error: any) {
      debugDevice('Error starting activity %s/%s: %s', appPackage, appActivity, error.message);
      throw new Error(`Failed to start activity ${appPackage}/${appActivity}: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Opens a URL
   *
   * @param url - URL to open
   */
  public async openUrl(url: string): Promise<void> {
    debugDevice('Opening URL: %s', url);
    const driver = await this.getDriver();

    try {
      await driver.url(url);
      debugDevice('Successfully opened URL: %s', url);
    } catch (error: any) {
      debugDevice('Error opening URL %s: %s', url, error.message);
      throw new Error(`Failed to open URL ${url}: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Closes the current app
   */
  public async closeApp(): Promise<void> {
    debugDevice('Closing app');

    try {
      // Use home button to close the current app
      await this.home();
      debugDevice('Successfully closed app by pressing home button');
    } catch (error: any) {
      debugDevice('Error closing app: %s', error.message);
      throw new Error(`Failed to close app: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Terminates an app
   *
   * @param appId - App package name
   */
  public async terminateApp(appId: string): Promise<boolean> {
    debugDevice('Terminating app: %s', appId);
    const driver = await this.getDriver();

    try {
      await driver.terminateApp(appId, {});
      debugDevice('Successfully terminated app: %s', appId);
      return true;
    } catch (error: any) {
      debugDevice('Error terminating app %s: %s', appId, error.message);
      throw new Error(`Failed to terminate app ${appId}: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Installs an app
   *
   * @param appPath - Path to the app
   */
  public async installApp(appPath: string): Promise<void> {
    debugDevice('Installing app: %s', appPath);
    const driver = await this.getDriver();

    try {
      await driver.installApp(appPath);
      debugDevice('Successfully installed app: %s', appPath);
    } catch (error: any) {
      debugDevice('Error installing app %s: %s', appPath, error.message);
      throw new Error(`Failed to install app ${appPath}: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Checks if an app is installed
   *
   * @param appId - App package name
   */
  public async isAppInstalled(appId: string): Promise<boolean> {
    debugDevice('Checking if app is installed: %s', appId);
    const driver = await this.getDriver();

    try {
      const result = await driver.isAppInstalled(appId);
      debugDevice('App %s installed: %s', appId, result);
      return result;
    } catch (error: any) {
      debugDevice('Error checking if app %s is installed: %s', appId, error.message);
      throw new Error(`Failed to check if app ${appId} is installed: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Removes an app
   *
   * @param appId - App package name
   */
  public async removeApp(appId: string): Promise<void> {
    debugDevice('Removing app: %s', appId);
    const driver = await this.getDriver();

    try {
      await driver.removeApp(appId);
      debugDevice('Successfully removed app: %s', appId);
    } catch (error: any) {
      debugDevice('Error removing app %s: %s', appId, error.message);
      throw new Error(`Failed to remove app ${appId}: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Gets the current activity
   */
  public async getCurrentActivity(): Promise<string> {
    debugDevice('Getting current activity');
    const driver = await this.getDriver();

    try {
      const activity = await driver.getCurrentActivity();
      debugDevice('Current activity: %s', activity);
      return activity;
    } catch (error: any) {
      debugDevice('Error getting current activity: %s', error.message);
      throw new Error(`Failed to get current activity: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Gets the current package
   */
  public async getCurrentPackage(): Promise<string> {
    debugDevice('Getting current package');
    const driver = await this.getDriver();

    try {
      const pkg = await driver.getCurrentPackage();
      debugDevice('Current package: %s', pkg);
      return pkg;
    } catch (error: any) {
      debugDevice('Error getting current package: %s', error.message);
      throw new Error(`Failed to get current package: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Gets the screen orientation
   */
  public async getScreenOrientation(): Promise<'PORTRAIT' | 'LANDSCAPE'> {
    debugDevice('Getting screen orientation');

    try {
      const size = await this.size();
      // Determine orientation based on screen dimensions
      const orientation = size.width > size.height ? 'LANDSCAPE' : 'PORTRAIT';
      debugDevice('Screen orientation: %s (based on dimensions %dx%d)', orientation, size.width, size.height);
      return orientation;
    } catch (error: any) {
      debugDevice('Error getting screen orientation: %s', error.message);
      throw new Error(`Failed to get screen orientation: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Sets the screen orientation
   *
   * @param orientation - Orientation to set
   */
  public async setScreenOrientation(orientation: 'PORTRAIT' | 'LANDSCAPE'): Promise<void> {
    debugDevice('Setting screen orientation to: %s', orientation);
    const driver = await this.getDriver();

    try {
      // Use device rotation instead of deprecated setOrientation
      if (orientation === 'LANDSCAPE') {
        await driver.rotateDevice(0, 0, 90); // Rotate to landscape
      } else {
        await driver.rotateDevice(0, 0, 0); // Rotate to portrait
      }
      debugDevice('Successfully set screen orientation to: %s', orientation);
    } catch (error: any) {
      debugDevice('Error setting screen orientation to %s: %s', orientation, error.message);
      // Fallback: try using key events to rotate screen
      try {
        // Some devices support rotation via key events
        if (orientation === 'LANDSCAPE') {
          await driver.pressKeyCode(168); // KEYCODE_ROTATE_LANDSCAPE
        } else {
          await driver.pressKeyCode(169); // KEYCODE_ROTATE_PORTRAIT
        }
        debugDevice('Successfully set screen orientation using key events');
      } catch (keyError) {
        debugDevice('Key event rotation also failed: %s', (keyError as Error).message);
        throw new Error(`Failed to set screen orientation to ${orientation}: ${error.message}`, {
          cause: error,
        });
      }
    }
  }

  /**
   * Gets the device time
   */
  public async getDeviceTime(): Promise<string> {
    debugDevice('Getting device time');
    const driver = await this.getDriver();

    try {
      const time = await driver.getDeviceTime();
      debugDevice('Device time: %s', time);
      return time;
    } catch (error: any) {
      debugDevice('Error getting device time: %s', error.message);
      throw new Error(`Failed to get device time: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Hides the keyboard
   */
  public async hideKeyboard(): Promise<void> {
    debugDevice('Hiding keyboard');
    const driver = await this.getDriver();

    try {
      await driver.hideKeyboard();
      debugDevice('Successfully hid keyboard');
    } catch (error: any) {
      debugDevice('Error hiding keyboard: %s', error.message);
      throw new Error(`Failed to hide keyboard: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Checks if the keyboard is shown
   */
  public async isKeyboardShown(): Promise<boolean> {
    debugDevice('Checking if keyboard is shown');
    const driver = await this.getDriver();

    try {
      const isShown = await driver.isKeyboardShown();
      debugDevice('Keyboard is shown: %s', isShown);
      return isShown;
    } catch (error: any) {
      debugDevice('Error checking if keyboard is shown: %s', error.message);
      throw new Error(`Failed to check if keyboard is shown: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Presses a key code
   *
   * @param keycode - Key code to press
   * @param metastate - Meta state
   * @param flags - Flags
   */
  public async pressKeyCode(keycode: number, metastate?: number, flags?: number): Promise<void> {
    debugDevice('Pressing key code: %d', keycode);
    const driver = await this.getDriver();

    try {
      await driver.pressKeyCode(keycode, metastate, flags);
      debugDevice('Successfully pressed key code: %d', keycode);
    } catch (error: any) {
      debugDevice('Error pressing key code %d: %s', keycode, error.message);
      throw new Error(`Failed to press key code ${keycode}: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Long presses a key code
   *
   * @param keycode - Key code to press
   * @param metastate - Meta state
   * @param flags - Flags
   */
  public async longPressKeyCode(keycode: number, metastate?: number, flags?: number): Promise<void> {
    debugDevice('Long pressing key code: %d', keycode);
    const driver = await this.getDriver();

    try {
      await driver.longPressKeyCode(keycode, metastate, flags);
      debugDevice('Successfully long pressed key code: %d', keycode);
    } catch (error: any) {
      debugDevice('Error long pressing key code %d: %s', keycode, error.message);
      throw new Error(`Failed to long press key code ${keycode}: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Gets available contexts
   */
  public async getContexts(): Promise<string[]> {
    debugDevice('Getting available contexts');
    const driver = await this.getDriver();

    try {
      const contexts = await driver.getContexts();
      const contextStrings = contexts.map(ctx => typeof ctx === 'string' ? ctx : ctx.id);
      debugDevice('Available contexts: %O', contextStrings);
      return contextStrings;
    } catch (error: any) {
      debugDevice('Error getting contexts: %s', error.message);
      throw new Error(`Failed to get contexts: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Gets the current context
   */
  public async getCurrentContext(): Promise<string> {
    debugDevice('Getting current context');
    const driver = await this.getDriver();

    try {
      const context = await driver.getContext();
      const contextString = typeof context === 'string' ? context : context.id;
      debugDevice('Current context: %s', contextString);
      return contextString;
    } catch (error: any) {
      debugDevice('Error getting current context: %s', error.message);
      throw new Error(`Failed to get current context: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Switches to a context
   *
   * @param contextName - Context to switch to
   */
  public async switchContext(contextName: string): Promise<void> {
    debugDevice('Switching to context: %s', contextName);
    const driver = await this.getDriver();

    try {
      await driver.switchContext(contextName);
      debugDevice('Successfully switched to context: %s', contextName);
    } catch (error: any) {
      debugDevice('Error switching to context %s: %s', contextName, error.message);
      throw new Error(`Failed to switch to context ${contextName}: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Executes a script
   *
   * @param script - Script to execute
   * @param args - Arguments for the script
   */
  public async executeScript(script: string, args?: any[]): Promise<any> {
    debugDevice('Executing script');
    const driver = await this.getDriver();

    try {
      const result = await driver.executeScript(script, args || []);
      debugDevice('Successfully executed script');
      return result;
    } catch (error: any) {
      debugDevice('Error executing script: %s', error.message);
      throw new Error(`Failed to execute script: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Scrolls to the top of the screen
   *
   * @param startingPoint - Optional starting point for the scroll
   */
  public async scrollUntilTop(startingPoint?: Point): Promise<void> {
    debugDevice('Scrolling to top');
    const size = await this.size();

    try {
      if (startingPoint) {
        const start = { x: startingPoint.left, y: startingPoint.top };
        const end = { x: start.x, y: 0 };

        await this.swipe(start.x, start.y, end.x, end.y);
      } else {
        // Scroll from middle bottom to middle top
        await this.swipe(size.width / 2, size.height * 0.8, size.width / 2, size.height * 0.2);
      }
      debugDevice('Successfully scrolled to top');
    } catch (error: any) {
      debugDevice('Error scrolling to top: %s', error.message);
      throw new Error(`Failed to scroll to top: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Scrolls to the bottom of the screen
   *
   * @param startingPoint - Optional starting point for the scroll
   */
  public async scrollUntilBottom(startingPoint?: Point): Promise<void> {
    debugDevice('Scrolling to bottom');
    const size = await this.size();

    try {
      if (startingPoint) {
        const start = { x: startingPoint.left, y: startingPoint.top };
        const end = { x: start.x, y: size.height };

        await this.swipe(start.x, start.y, end.x, end.y);
      } else {
        // Scroll from middle top to middle bottom
        await this.swipe(size.width / 2, size.height * 0.2, size.width / 2, size.height * 0.8);
      }
      debugDevice('Successfully scrolled to bottom');
    } catch (error: any) {
      debugDevice('Error scrolling to bottom: %s', error.message);
      throw new Error(`Failed to scroll to bottom: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Scrolls to the left of the screen
   *
   * @param startingPoint - Optional starting point for the scroll
   */
  public async scrollUntilLeft(startingPoint?: Point): Promise<void> {
    debugDevice('Scrolling to left');
    const size = await this.size();

    try {
      if (startingPoint) {
        const start = { x: startingPoint.left, y: startingPoint.top };
        const end = { x: 0, y: start.y };

        await this.swipe(start.x, start.y, end.x, end.y);
      } else {
        // Scroll from middle right to middle left
        await this.swipe(size.width * 0.8, size.height / 2, size.width * 0.2, size.height / 2);
      }
      debugDevice('Successfully scrolled to left');
    } catch (error: any) {
      debugDevice('Error scrolling to left: %s', error.message);
      throw new Error(`Failed to scroll to left: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Scrolls to the right of the screen
   *
   * @param startingPoint - Optional starting point for the scroll
   */
  public async scrollUntilRight(startingPoint?: Point): Promise<void> {
    debugDevice('Scrolling to right');
    const size = await this.size();

    try {
      if (startingPoint) {
        const start = { x: startingPoint.left, y: startingPoint.top };
        const end = { x: size.width, y: start.y };

        await this.swipe(start.x, start.y, end.x, end.y);
      } else {
        // Scroll from middle left to middle right
        await this.swipe(size.width * 0.2, size.height / 2, size.width * 0.8, size.height / 2);
      }
      debugDevice('Successfully scrolled to right');
    } catch (error: any) {
      debugDevice('Error scrolling to right: %s', error.message);
      throw new Error(`Failed to scroll to right: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Scrolls up by a specified distance
   *
   * @param distance - Distance to scroll (default: 200)
   * @param startingPoint - Optional starting point for the scroll
   */
  public async scrollUp(distance: number = 200, startingPoint?: Point): Promise<void> {
    debugDevice('Scrolling up by %d pixels', distance);
    const size = await this.size();

    try {
      if (startingPoint) {
        const start = { x: startingPoint.left, y: startingPoint.top };
        const end = { x: start.x, y: Math.max(0, start.y - distance) };

        await this.swipe(start.x, start.y, end.x, end.y);
      } else {
        // Scroll from middle of screen
        const startY = size.height / 2;
        const endY = Math.max(0, startY - distance);
        await this.swipe(size.width / 2, startY, size.width / 2, endY);
      }
      debugDevice('Successfully scrolled up');
    } catch (error: any) {
      debugDevice('Error scrolling up: %s', error.message);
      throw new Error(`Failed to scroll up: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Scrolls down by a specified distance
   *
   * @param distance - Distance to scroll (default: 200)
   * @param startingPoint - Optional starting point for the scroll
   */
  public async scrollDown(distance: number = 200, startingPoint?: Point): Promise<void> {
    debugDevice('Scrolling down by %d pixels', distance);
    const size = await this.size();

    try {
      if (startingPoint) {
        const start = { x: startingPoint.left, y: startingPoint.top };
        const end = { x: start.x, y: Math.min(size.height, start.y + distance) };

        await this.swipe(start.x, start.y, end.x, end.y);
      } else {
        // Scroll from middle of screen
        const startY = size.height / 2;
        const endY = Math.min(size.height, startY + distance);
        await this.swipe(size.width / 2, startY, size.width / 2, endY);
      }
      debugDevice('Successfully scrolled down');
    } catch (error: any) {
      debugDevice('Error scrolling down: %s', error.message);
      throw new Error(`Failed to scroll down: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Scrolls left by a specified distance
   *
   * @param distance - Distance to scroll (default: 200)
   * @param startingPoint - Optional starting point for the scroll
   */
  public async scrollLeft(distance: number = 200, startingPoint?: Point): Promise<void> {
    debugDevice('Scrolling left by %d pixels', distance);
    const size = await this.size();

    try {
      if (startingPoint) {
        const start = { x: startingPoint.left, y: startingPoint.top };
        const end = { x: Math.max(0, start.x - distance), y: start.y };

        await this.swipe(start.x, start.y, end.x, end.y);
      } else {
        // Scroll from middle of screen
        const startX = size.width / 2;
        const endX = Math.max(0, startX - distance);
        await this.swipe(startX, size.height / 2, endX, size.height / 2);
      }
      debugDevice('Successfully scrolled left');
    } catch (error: any) {
      debugDevice('Error scrolling left: %s', error.message);
      throw new Error(`Failed to scroll left: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Scrolls right by a specified distance
   *
   * @param distance - Distance to scroll (default: 200)
   * @param startingPoint - Optional starting point for the scroll
   */
  public async scrollRight(distance: number = 200, startingPoint?: Point): Promise<void> {
    debugDevice('Scrolling right by %d pixels', distance);
    const size = await this.size();

    try {
      if (startingPoint) {
        const start = { x: startingPoint.left, y: startingPoint.top };
        const endX = Math.min(size.width, start.x + distance);
        const end = { x: endX, y: start.y };
        await this.swipe(start.x, start.y, end.x, end.y);
      } else {
        // Scroll from middle of screen
        const startX = size.width / 2;
        const endX = Math.min(size.width, startX + distance);
        await this.swipe(startX, size.height / 2, endX, size.height / 2);
      }
      debugDevice('Successfully scrolled right');
    } catch (error: any) {
      debugDevice('Error scrolling right: %s', error.message);
      throw new Error(`Failed to scroll right: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Performs a swipe gesture using W3C Actions API
   *
   * @param startX - Starting X coordinate
   * @param startY - Starting Y coordinate
   * @param endX - Ending X coordinate
   * @param endY - Ending Y coordinate
   * @param duration - Duration of the swipe in milliseconds (default: 800)
   */
  public async swipe(startX: number, startY: number, endX: number, endY: number, duration: number = 800): Promise<void> {
    debugDevice('Swiping from (%d, %d) to (%d, %d)', startX, startY, endX, endY);
    const driver = await this.getDriver();

    try {
      // Use W3C Actions API instead of deprecated touchAction
      await driver.performActions([{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: startX, y: startY },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 100 },
          { type: 'pointerMove', duration: duration, x: endX, y: endY },
          { type: 'pointerUp', button: 0 }
        ]
      }]);
      debugDevice('Successfully performed swipe');
    } catch (error: any) {
      debugDevice('Error performing swipe: %s', error.message);
      throw new Error(`Failed to perform swipe: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Presses the back button
   */
  public async back(): Promise<void> {
    debugDevice('Pressing back button');
    const driver = await this.getDriver();

    try {
      await driver.back();
      debugDevice('Successfully pressed back button');
    } catch (error: any) {
      debugDevice('Error pressing back button: %s', error.message);
      throw new Error(`Failed to press back button: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Presses the home button
   */
  public async home(): Promise<void> {
    debugDevice('Pressing home button');
    const driver = await this.getDriver();

    try {
      // Using keycode for HOME button
      await driver.pressKeyCode(3);
      debugDevice('Successfully pressed home button');
    } catch (error: any) {
      debugDevice('Error pressing home button: %s', error.message);
      throw new Error(`Failed to press home button: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Opens the recent apps screen
   */
  public async recentApps(): Promise<void> {
    debugDevice('Opening recent apps');
    const driver = await this.getDriver();

    try {
      // Using keycode for RECENT_APPS button
      await driver.pressKeyCode(187);
      debugDevice('Successfully opened recent apps');
    } catch (error: any) {
      debugDevice('Error opening recent apps: %s', error.message);
      throw new Error(`Failed to open recent apps: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Gets the elements info (deprecated, use getElementsNodeTree instead)
   */
  public async getElementsInfo(): Promise<ElementInfo[]> {
    debugDevice('Getting elements info (deprecated)');
    const tree = await this.getElementsNodeTree();

    // Convert tree to flat list
    const elements: ElementInfo[] = [];
    const traverse = (node: ElementTreeNode<ElementInfo>) => {
      if (node.node) {
        elements.push(node.node);
      }
      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(tree);
    return elements;
  }

  /**
   * Mouse actions
   */
  get mouse() {
    return {
      click: async (x: number, y: number) => {
        debugDevice('Mouse click at (%d, %d)', x, y);
        await this.tap(x, y);
      },
      wheel: async (deltaX: number, deltaY: number) => {
        debugDevice('Mouse wheel with deltaX: %d, deltaY: %d', deltaX, deltaY);
        // Implement scrolling based on delta values
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal scrolling
          if (deltaX > 0) {
            await this.scrollRight(Math.abs(deltaX));
          } else {
            await this.scrollLeft(Math.abs(deltaX));
          }
        } else {
          // Vertical scrolling
          if (deltaY > 0) {
            await this.scrollDown(Math.abs(deltaY));
          } else {
            await this.scrollUp(Math.abs(deltaY));
          }
        }
      },
      move: async (x: number, y: number) => {
        debugDevice('Mouse move to (%d, %d)', x, y);
        // Not directly supported in Appium, but can be simulated if needed
      },
      drag: async (from: { x: number; y: number }, to: { x: number; y: number }) => {
        debugDevice('Mouse drag from (%d, %d) to (%d, %d)', from.x, from.y, to.x, to.y);
        await this.swipe(from.x, from.y, to.x, to.y);
      }
    };
  }

  /**
   * Keyboard actions using W3C Actions API
   */
  get keyboard() {
    return {
      type: async (text: string) => {
        debugDevice('Keyboard type: %s', text);
        if (!text) return;

        const driver = await this.getDriver();
        const isChinese = /[\p{Script=Han}\p{sc=Hani}]/u.test(text);

        // For pure ASCII characters, use sendKeys which is more reliable
        if (!isChinese) {
          try {
            // Use driver.keys for simple text input
            await driver.keys(text);
          } catch (error) {
            // Fallback to using W3C Actions API
            await driver.performActions([{
              type: 'key',
              id: 'keyboard',
              actions: text.split('').flatMap(char => [
                { type: 'keyDown', value: char },
                { type: 'keyUp', value: char }
              ])
            }]);
          }
        } else {
          // For non-ASCII characters (like Chinese), use keys which handles IME better
          try {
            await driver.keys(text);
          } catch (error) {
            debugDevice('Error typing Chinese text: %s', (error as Error).message);
            // Try alternative approach with setValue on a found input element
            try {
              const inputElements = await driver.$$('//android.widget.EditText');
              if (inputElements.length > 0) {
                await inputElements[0].setValue(text);
              } else {
                throw new Error('No input elements found');
              }
            } catch (setValueError) {
              debugDevice('setValue also failed: %s', (setValueError as Error).message);
              throw error; // Re-throw original error
            }
          }
        }

        // Hide keyboard after typing
        try {
          await this.hideKeyboard();
        } catch (error) {
          // Ignore keyboard hide errors as it might not be visible
          debugDevice('Could not hide keyboard: %s', (error as Error).message);
        }
      },
      press: async (action: { key: string; command?: string } | { key: string; command?: string }[]) => {
        debugDevice('Keyboard press: %O', action);
        const driver = await this.getDriver();

        const pressKey = async (key: string) => {
          // Map common keys to Android key codes
          const keyCodeMap: Record<string, number> = {
            'Enter': 66,
            'Tab': 61,
            'Backspace': 67,
            'Delete': 112,
            'Escape': 111,
            'ArrowUp': 19,
            'ArrowDown': 20,
            'ArrowLeft': 21,
            'ArrowRight': 22,
            'Home': 122,
            'End': 123,
            'PageUp': 92,
            'PageDown': 93,
            'Space': 62
          };

          if (key in keyCodeMap) {
            // For special keys, still use pressKeyCode as it's more reliable for Android
            await driver.pressKeyCode(keyCodeMap[key]);
          } else if (key.length === 1) {
            // For single characters, use W3C Actions API
            await driver.performActions([{
              type: 'key',
              id: 'keyboard',
              actions: [
                { type: 'keyDown', value: key },
                { type: 'keyUp', value: key }
              ]
            }]);
          }
        };

        if (Array.isArray(action)) {
          for (const act of action) {
            await pressKey(act.key);
          }
        } else {
          await pressKey(action.key);
        }
      }
    };
  }

  /**
   * Clears input in an element
   *
   * @param element - Element to clear
   */
  public async clearInput(element: ElementInfo): Promise<void> {
    debugDevice('Clearing input in element: %s', element.id);

    try {
      const driver = await this.getDriver();

      // First, tap on the element to focus it
      await this.tap(element.center[0], element.center[1]);

      // Try multiple approaches to clear the input
      try {
        // Method 1: Try to find the element and clear it directly
        if (element.attributes['resource-id']) {
          const elem = await driver.$(`[resource-id="${element.attributes['resource-id']}"]`);
          if (await elem.isExisting()) {
            await elem.clearValue();
            debugDevice('Successfully cleared input using clearValue');
            return;
          }
        }
      } catch (error) {
        debugDevice('clearValue method failed: %s', (error as Error).message);
      }

      // Method 2: Use key events to select all and delete
      try {
        // Send Ctrl+A to select all text (using META key for Android)
        await driver.pressKeyCode(29, 1); // 29 is 'A', 1 is META_SHIFT_ON for Ctrl+A
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay

        // Then send Delete to clear the selection
        await driver.pressKeyCode(67); // 67 is DELETE/BACKSPACE
        debugDevice('Successfully cleared input using key events');
      } catch (error) {
        debugDevice('Key events method failed: %s', (error as Error).message);

        // Method 3: Fallback - send multiple backspace keys
        try {
          // Send backspace multiple times to clear the field
          for (let i = 0; i < 50; i++) { // Arbitrary limit to prevent infinite loop
            await driver.pressKeyCode(67); // BACKSPACE
          }
          debugDevice('Successfully cleared input using multiple backspaces');
        } catch (backspaceError) {
          debugDevice('Backspace method also failed: %s', (backspaceError as Error).message);
          throw new Error('All clear input methods failed');
        }
      }

    } catch (error: any) {
      debugDevice('Error clearing input: %s', error.message);
      throw new Error(`Failed to clear input: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Performs a tap at the specified coordinates using W3C Actions API
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   */
  public async tap(x: number, y: number): Promise<void> {
    debugDevice('Tapping at (%d, %d)', x, y);
    const driver = await this.getDriver();

    try {
      // Use W3C Actions API instead of deprecated touchAction
      await driver.performActions([{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x, y },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 100 },
          { type: 'pointerUp', button: 0 }
        ]
      }]);
      debugDevice('Successfully tapped at (%d, %d)', x, y);
    } catch (error: any) {
      debugDevice('Error tapping at (%d, %d): %s', x, y, error.message);
      throw new Error(`Failed to tap at (${x}, ${y}): ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Gets XPaths for elements with the specified ID
   *
   * @param id - Element ID to search for
   */
  public async getXpathsById(id: string): Promise<string[]> {
    debugDevice('Getting XPaths for ID: %s', id);
    const driver = await this.getDriver();

    try {
      // Find elements by resource-id
      const elements = await driver.$$(`[resource-id="${id}"]`);

      // Generate XPaths for found elements
      const xpaths: string[] = [];
      for (let i = 0; i < elements.length; i++) {
        // For Android, we can use the resource-id as a simple XPath
        xpaths.push(`//*[@resource-id="${id}"][${i + 1}]`);
      }

      debugDevice('Found %d XPaths for ID %s', xpaths.length, id);
      return xpaths;
    } catch (error: any) {
      debugDevice('Error getting XPaths for ID %s: %s', id, error.message);
      throw new Error(`Failed to get XPaths for ID ${id}: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Gets element info by XPath
   *
   * @param xpath - XPath to search for
   */
  public async getElementInfoByXpath(xpath: string): Promise<ElementInfo> {
    debugDevice('Getting element info for XPath: %s', xpath);
    const driver = await this.getDriver();

    try {
      const element = await driver.$(xpath);

      if (!await element.isExisting()) {
        throw new Error(`Element not found for XPath: ${xpath}`);
      }

      // Get element properties using WebdriverIO methods
      const location = await element.getLocation();
      const size = await element.getSize();
      const text = await element.getText();
      const resourceId = await element.getAttribute('resource-id');
      const className = await element.getAttribute('class');
      const contentDesc = await element.getAttribute('content-desc');

      // Create ElementInfo object
      const elementInfo: ElementInfo = {
        id: resourceId || `xpath-${Date.now()}`,
        indexId: 0,
        nodeHashId: resourceId || xpath,
        locator: xpath,
        attributes: {
          nodeType: this.getNodeTypeFromClassName(className),
          'resource-id': resourceId,
          'class': className,
          'content-desc': contentDesc,
        },
        nodeType: this.getNodeTypeFromClassName(className),
        content: text || contentDesc || '',
        rect: {
          left: location.x,
          top: location.y,
          width: size.width,
          height: size.height
        },
        center: [location.x + size.width / 2, location.y + size.height / 2]
      };

      debugDevice('Successfully got element info for XPath: %s', xpath);
      return elementInfo;
    } catch (error: any) {
      debugDevice('Error getting element info for XPath %s: %s', xpath, error.message);
      throw new Error(`Failed to get element info for XPath ${xpath}: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Helper method to determine node type from class name
   */
  private getNodeTypeFromClassName(className: string | null): NodeType {
    if (!className) return NodeType.CONTAINER;

    const lowerClassName = className.toLowerCase();

    if (lowerClassName.includes('button')) return NodeType.BUTTON;
    if (lowerClassName.includes('text') || lowerClassName.includes('edit')) return NodeType.TEXT;
    if (lowerClassName.includes('image')) return NodeType.IMG;
    if (lowerClassName.includes('input') || lowerClassName.includes('edit')) return NodeType.FORM_ITEM;

    return NodeType.CONTAINER;
  }

  /**
   * Gets device information including screen size and orientation
   */
  public async getDeviceInfo(): Promise<{
    screenSize: Size;
    orientation: 'PORTRAIT' | 'LANDSCAPE';
    deviceTime: string;
    currentPackage: string;
    currentActivity: string;
  }> {
    debugDevice('Getting device information');

    try {
      const [screenSize, orientation, deviceTime, currentPackage, currentActivity] = await Promise.all([
        this.size(),
        this.getScreenOrientation(),
        this.getDeviceTime(),
        this.getCurrentPackage(),
        this.getCurrentActivity()
      ]);

      const deviceInfo = {
        screenSize,
        orientation,
        deviceTime,
        currentPackage,
        currentActivity
      };

      debugDevice('Device info: %O', deviceInfo);
      return deviceInfo;
    } catch (error: any) {
      debugDevice('Error getting device info: %s', error.message);
      throw new Error(`Failed to get device info: ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Waits for an element to appear on screen
   *
   * @param selector - Element selector
   * @param timeout - Timeout in milliseconds (default: 10000)
   */
  public async waitForElement(selector: string, timeout: number = 10000): Promise<WebdriverIO.Element> {
    debugDevice('Waiting for element: %s (timeout: %dms)', selector, timeout);
    const driver = await this.getDriver();

    try {
      const element = await driver.$(selector);
      await element.waitForExist({ timeout });
      debugDevice('Element found: %s', selector);
      return element;
    } catch (error: any) {
      debugDevice('Element not found within timeout: %s', selector);
      throw new Error(`Element not found within ${timeout}ms: ${selector}`, {
        cause: error,
      });
    }
  }

  /**
   * Waits for an element to disappear from screen
   *
   * @param selector - Element selector
   * @param timeout - Timeout in milliseconds (default: 10000)
   */
  public async waitForElementToDisappear(selector: string, timeout: number = 10000): Promise<void> {
    debugDevice('Waiting for element to disappear: %s (timeout: %dms)', selector, timeout);
    const driver = await this.getDriver();

    try {
      const element = await driver.$(selector);
      await element.waitForExist({ timeout, reverse: true });
      debugDevice('Element disappeared: %s', selector);
    } catch (error: any) {
      debugDevice('Element did not disappear within timeout: %s', selector);
      throw new Error(`Element did not disappear within ${timeout}ms: ${selector}`, {
        cause: error,
      });
    }
  }

  /**
   * Performs a long press at the specified coordinates
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param duration - Duration of the long press in milliseconds (default: 1000)
   */
  public async longPress(x: number, y: number, duration: number = 1000): Promise<void> {
    debugDevice('Long pressing at (%d, %d) for %dms', x, y, duration);
    const driver = await this.getDriver();

    try {
      await driver.performActions([{
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x, y },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration },
          { type: 'pointerUp', button: 0 }
        ]
      }]);
      debugDevice('Successfully performed long press at (%d, %d)', x, y);
    } catch (error: any) {
      debugDevice('Error performing long press at (%d, %d): %s', x, y, error.message);
      throw new Error(`Failed to perform long press at (${x}, ${y}): ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Performs a double tap at the specified coordinates
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   */
  public async doubleTap(x: number, y: number): Promise<void> {
    debugDevice('Double tapping at (%d, %d)', x, y);

    try {
      await this.tap(x, y);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between taps
      await this.tap(x, y);
      debugDevice('Successfully performed double tap at (%d, %d)', x, y);
    } catch (error: any) {
      debugDevice('Error performing double tap at (%d, %d): %s', x, y, error.message);
      throw new Error(`Failed to perform double tap at (${x}, ${y}): ${error.message}`, {
        cause: error,
      });
    }
  }

  /**
   * Destroys the device connection
   */
  public async destroy(): Promise<void> {
    debugDevice('Destroying device connection');
    await this.disconnect();
  }
}
