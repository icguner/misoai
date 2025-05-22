/**
 * Appium server configuration options
 */
export interface AppiumServerConfig {
  /**
   * Hostname of the Appium server
   */
  hostname: string;

  /**
   * Port number of the Appium server
   */
  port: number;

  /**
   * Path to the WebDriver endpoint (default: '/wd/hub')
   */
  path?: string;

  /**
   * Protocol to use (default: 'http')
   */
  protocol?: 'http' | 'https';
}

/**
 * Base capabilities for Appium Android sessions
 */
export interface AppiumBaseCapabilities {
  /**
   * Platform name (must be 'Android')
   */
  platformName: 'Android';

  /**
   * Automation name (e.g., 'UiAutomator2', 'Espresso')
   */
  'appium:automationName'?: string;

  /**
   * Android platform version
   */
  'appium:platformVersion'?: string;

  /**
   * Device name
   */
  'appium:deviceName'?: string;

  /**
   * Device UDID (unique device identifier)
   */
  'appium:udid'?: string;

  /**
   * Path or URL to APK file
   */
  'appium:app'?: string;

  /**
   * Package name of the Android app
   */
  'appium:appPackage'?: string;

  /**
   * Activity name to launch
   */
  'appium:appActivity'?: string;

  /**
   * Timeout for new commands in seconds
   */
  'appium:newCommandTimeout'?: number;

  /**
   * Automatically grant permissions to the app
   */
  'appium:autoGrantPermissions'?: boolean;

  /**
   * Other vendor-specific capabilities
   */
  [key: string]: any;
}

/**
 * Sauce Labs specific options
 */
export interface SauceLabsSpecificOptions {
  /**
   * Build identifier
   */
  build?: string;

  /**
   * Test name
   */
  name?: string;

  /**
   * Tags for the test
   */
  tags?: string[];

  /**
   * Tunnel identifier for Sauce Connect
   */
  tunnelIdentifier?: string;

  /**
   * Appium version to use
   */
  appiumVersion?: string;

  /**
   * Sauce Labs username
   */
  username?: string;

  /**
   * Sauce Labs access key
   */
  accessKey?: string;
}

/**
 * Sauce Labs capabilities
 */
export interface SauceLabsCapabilities extends AppiumBaseCapabilities {
  /**
   * Sauce Labs specific options
   */
  'sauce:options'?: SauceLabsSpecificOptions;
}

/**
 * Sauce Labs configuration
 */
export interface SauceLabsConfig {
  /**
   * Sauce Labs username
   */
  user: string;

  /**
   * Sauce Labs access key
   */
  key: string;

  /**
   * Sauce Labs region
   */
  region: 'us-west-1' | 'eu-central-1' | 'us-east-1';

  /**
   * Whether to use headless testing
   */
  headless?: boolean;
}
