import { PageAgent, type PageAgentOpt } from 'rfi-ai-web/agent';
import { AndroidDevice, type AndroidDeviceOpt } from '../page';
import { vlLocateMode } from 'rfi-ai-shared/env';
import { getConnectedDevices } from '../utils';
import { getDebug } from 'rfi-ai-shared/logger';

import { debugPage } from '../page';

const debugDevice = getDebug('android-device');

// Re-export AndroidDevice for external use
export { AndroidDevice, type AndroidDeviceOpt };

type AndroidAgentOpt = PageAgentOpt;

export class AndroidAgent extends PageAgent<AndroidDevice> {
  constructor(page: AndroidDevice, opts?: AndroidAgentOpt) {
    super(page, opts);

    if (!vlLocateMode()) {
      throw new Error(
        'Android Agent only supports vl-model. RFI-AI',
      );
    }
  }

  async launch(uri: string): Promise<void> {
    const device = this.page;
    await device.launch(uri);
  }
}

import { AppiumServerConfig, AppiumBaseCapabilities, SauceLabsConfig, SauceLabsCapabilities } from '../types';

// AppiumDevice class for Appium integration
export class AppiumDevice extends AndroidDevice {
  constructor(private config: AppiumServerConfig, private capabilities: AppiumBaseCapabilities) {
    super('appium-device', {
      hostname: config.hostname,
      port: config.port,
      protocol: config.protocol,
      path: config.path,
      capabilities: capabilities
    });
  }

  async connect(): Promise<void> {
    debugDevice('Connecting to Appium server at %s://%s:%s', 
      this.config.protocol, this.config.hostname, this.config.port);
    
    // Use the parent class connect method which properly initializes WebDriverIO
    await super.connect();
  }

  async getCurrentPackage(): Promise<string> {
    const driver = await this.getDriver();
    try {
      // Get current activity/package using WebDriverIO
      const currentActivity = await driver.getCurrentActivity();
      const currentPackage = await driver.getCurrentPackage();
      return currentPackage || 'unknown';
    } catch (error) {
      debugDevice('Error getting current package: %s', (error as Error).message);
      return 'unknown';
    }
  }

  async getDriver(): Promise<any> {
    // Use the parent class getDriver method which properly manages WebDriverIO connection
    return super.getDriver();
  }
}

export async function agentFromAdbDevice(
  deviceId?: string,
  opts?: AndroidAgentOpt & AndroidDeviceOpt,
) {
  if (!deviceId) {
    const devices = await getConnectedDevices();
    if (devices.length === 0) {
      throw new Error('No connected Android devices found');
    }
    deviceId = devices[0];
  }

  const page = new AndroidDevice(deviceId, {
    autoDismissKeyboard: opts?.autoDismissKeyboard,
    imeStrategy: opts?.imeStrategy,
  });

  return new AndroidAgent(page, opts);
}

/**
 * Creates an AndroidAgent from an Appium server
 *
 * @param config - Appium server configuration
 * @param capabilities - Appium capabilities
 * @param agentOpts - Optional agent options
 * @returns Promise resolving to an AndroidAgent
 */
export async function agentFromAppiumServer(
  config: AppiumServerConfig,
  capabilities: AppiumBaseCapabilities,
  agentOpts?: PageAgentOpt
): Promise<AndroidAgent> {
  const device = new AppiumDevice(config, capabilities);

  try {
    await device.connect();
    return new AndroidAgent(device, agentOpts);
  } catch (error: any) {
    debugDevice('Failed to connect to Appium server: %s', error.message);
    throw new Error(`Failed to connect to Appium server: ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * Creates an AndroidAgent from a local Appium server
 *
 * @param capabilities - Appium capabilities
 * @param agentOpts - Optional agent options
 * @returns Promise resolving to an AndroidAgent
 */
export async function agentFromLocalAppium(
  capabilities: AppiumBaseCapabilities,
  agentOpts?: PageAgentOpt
): Promise<AndroidAgent> {
  const localServerConfig: AppiumServerConfig = {
    hostname: '127.0.0.1',
    port: 4723,
    protocol: 'http'
  };

  return agentFromAppiumServer(localServerConfig, capabilities, agentOpts);
}

/**
 * Creates an AndroidAgent from Sauce Labs
 *
 * @param slConfig - Sauce Labs configuration
 * @param capabilities - Appium capabilities with Sauce Labs options
 * @param agentOpts - Optional agent options
 * @returns Promise resolving to an AndroidAgent
 */
export async function agentFromSauceLabs(
  slConfig: SauceLabsConfig,
  capabilities: AppiumBaseCapabilities & SauceLabsCapabilities,
  agentOpts?: PageAgentOpt
): Promise<AndroidAgent> {
  // Construct Sauce Labs server config
  const sauceServerConfig: AppiumServerConfig = {
    hostname: `ondemand.${slConfig.region}.saucelabs.com`,
    port: 443,
    protocol: 'https',
    path: '/wd/hub'
  };

  // Ensure sauce:options contains username and access key
  if (!capabilities['sauce:options']) {
    capabilities['sauce:options'] = {};
  }

  capabilities['sauce:options'].username = slConfig.user;
  capabilities['sauce:options'].accessKey = slConfig.key;

  return agentFromAppiumServer(sauceServerConfig, capabilities, agentOpts);
}