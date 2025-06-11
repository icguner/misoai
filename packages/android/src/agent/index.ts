import { vlLocateMode } from 'misoai-shared/env';
import { PageAgent, type PageAgentOpt } from 'misoai-web/agent';
import { AndroidDevice, type AndroidDeviceOpt } from '../page';
import { getConnectedDevices } from '../utils';

import { debugPage } from '../page';

type AndroidAgentOpt = PageAgentOpt;

export class AndroidAgent extends PageAgent<AndroidDevice> {
  constructor(page: AndroidDevice, opts?: AndroidAgentOpt) {
    super(page, opts);

    if (!vlLocateMode()) {
      throw new Error(
        'Android Agent only supports vl-model. https://acabai.com/choose-a-model.html',
      );
    }
  }

  async launch(uri: string): Promise<void> {
    const device = this.page;
    await device.launch(uri);
  }
}

import type { AppiumBaseCapabilities, AppiumServerConfig, SauceLabsCapabilities, SauceLabsConfig } from '../types';

export async function agentFromAdbDevice(
  deviceId?: string,
  opts?: AndroidAgentOpt & AndroidDeviceOpt,
) {
  if (!deviceId) {
    const devices = await getConnectedDevices();

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

  const page = new AndroidDevice(deviceId, {
    autoDismissKeyboard: opts?.autoDismissKeyboard,
    androidAdbPath: opts?.androidAdbPath,
    remoteAdbHost: opts?.remoteAdbHost,
    remoteAdbPort: opts?.remoteAdbPort,
  });

  return agentFromAppiumServer(sauceServerConfig, capabilities, agentOpts);
}
