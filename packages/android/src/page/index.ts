import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { type Point, type Size, getAIConfig } from 'misoai-core';
import type { PageType } from 'misoai-core';
import { getTmpFile, sleep } from 'misoai-core/utils';
import {
  MIDSCENE_ADB_PATH,
  MIDSCENE_ADB_REMOTE_HOST,
  MIDSCENE_ADB_REMOTE_PORT,
  MIDSCENE_ANDROID_IME_STRATEGY,
} from '@midscene/shared/env';
import type { ElementInfo } from '@midscene/shared/extractor';
import { isValidPNGImageBuffer, resizeImg } from '@midscene/shared/img';
import { getDebug } from '@midscene/shared/logger';
import { repeat } from '@midscene/shared/utils';
import type { AndroidDeviceInputOpt, AndroidDevicePage } from '@midscene/web';
import { ADB } from 'appium-adb';

const androidScreenshotPath = '/data/local/tmp/midscene_screenshot.png';
// only for Android, because it's impossible to scroll to the bottom, so we need to set a default scroll times
const defaultScrollUntilTimes = 10;
const defaultFastScrollDuration = 100;
const defaultNormalScrollDuration = 1000;

export const debugPage = getDebug('android:device');
export type AndroidDeviceOpt = {
  androidAdbPath?: string;
  remoteAdbHost?: string;
  remoteAdbPort?: number;
  imeStrategy?: 'always-yadb' | 'yadb-for-non-ascii';
} & AndroidDeviceInputOpt;

export class AndroidDevice implements AndroidDevicePage {
  private deviceId: string;
  private screenSize: Size | null = null;
  private yadbPushed = false;
  private deviceRatio = 1;
  private adb: ADB | null = null;
  private connectingAdb: Promise<ADB> | null = null;
  private destroyed = false;
  pageType: PageType = 'android';
  uri: string | undefined;
  options?: AndroidDeviceOpt;

  constructor(deviceId: string, options?: AndroidDeviceOpt) {
    assert(deviceId, 'deviceId is required for AndroidDevice');

    this.deviceId = deviceId;
    this.options = options;
  }

  public async connect(): Promise<ADB> {
    return this.getAdb();
  }

  public async getAdb(): Promise<ADB> {
    if (this.destroyed) {
      throw new Error(
        `AndroidDevice ${this.deviceId} has been destroyed and cannot execute ADB commands`,
      );
    }

    // if already has ADB instance, return it
    if (this.adb) {
      return this.createAdbProxy(this.adb);
    }

    // If already connecting, wait for connection to complete
    if (this.connectingAdb) {
      return this.connectingAdb.then((adb) => this.createAdbProxy(adb));
    }

    // Create new connection Promise
    this.connectingAdb = (async () => {
      let error: Error | null = null;
      debugPage(`Initializing ADB with device ID: ${this.deviceId}`);

      try {
        const androidAdbPath =
          this.options?.androidAdbPath || getAIConfig(MIDSCENE_ADB_PATH);
        const remoteAdbHost =
          this.options?.remoteAdbHost || getAIConfig(MIDSCENE_ADB_REMOTE_HOST);
        const remoteAdbPort =
          this.options?.remoteAdbPort || getAIConfig(MIDSCENE_ADB_REMOTE_PORT);

        this.adb = await new ADB({
          udid: this.deviceId,
          adbExecTimeout: 60000,
          executable: androidAdbPath
            ? { path: androidAdbPath, defaultArgs: [] }
            : undefined,
          remoteAdbHost: remoteAdbHost || undefined,
          remoteAdbPort: remoteAdbPort ? Number(remoteAdbPort) : undefined,
        });

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
        debugPage('ADB initialized successfully');
        return this.adb;
      } catch (e) {
        debugPage(`Failed to initialize ADB: ${e}`);
        error = new Error(`Unable to connect to device ${this.deviceId}: ${e}`);
      } finally {
        this.connectingAdb = null;
      }

      if (error) {
        throw error;
      }

      throw new Error('ADB initialization failed unexpectedly');
    })();

    return this.connectingAdb;
  }

  private createAdbProxy(adb: ADB): ADB {
    // create ADB proxy object, intercept all method calls
    return new Proxy(adb, {
      get: (target, prop) => {
        const originalMethod = target[prop as keyof typeof target];

        // if the property is not a function, return the original value
        if (typeof originalMethod !== 'function') {
          return originalMethod;
        }

        // return the proxied method
        return async (...args: any[]) => {
          try {
            debugPage(`adb ${String(prop)} ${args.join(' ')}`);
            return originalMethod.apply(target, args);
          } catch (error: any) {
            const methodName = String(prop);
            const deviceId = this.deviceId;
            debugPage(
              `ADB error with device ${deviceId} when calling ${methodName}: ${error}`,
            );

            // throw the error again
            throw new Error(
              `ADB error with device ${deviceId} when calling ${methodName}, please check https://midscenejs.com/integrate-with-android.html#faq : ${error.message}`,
              {
                cause: error,
              },
            );
          }
        };
      },
    });
  }

  public async launch(uri: string): Promise<AndroidDevice> {
    const adb = await this.getAdb();
    this.uri = uri;

    try {
      if (
        uri.startsWith('http://') ||
        uri.startsWith('https://') ||
        uri.includes('://')
      ) {
        // If it's a URI with scheme
        await adb.startUri(uri);
      } else if (uri.includes('/')) {
        // If it's in format like 'com.android/settings.Settings'
        const [appPackage, appActivity] = uri.split('/');
        await adb.startApp({
          pkg: appPackage,
          activity: appActivity,
        });
      } else {
        // Assume it's just a package name
        await adb.activateApp(uri);
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

  private async execYadb(keyboardContent: string): Promise<void> {
    await this.ensureYadb();

    const adb = await this.getAdb();

    await adb.shell(
      `app_process -Djava.class.path=/data/local/tmp/yadb /data/local/tmp com.ysbing.yadb.Main -keyboard "${keyboardContent}"`,
    );
  }

  // @deprecated
  async getElementsInfo(): Promise<ElementInfo[]> {
    return [];
  }

  async getElementsNodeTree(): Promise<any> {
    // Simplified implementation, returns an empty node tree
    return {
      node: null,
      children: [],
    };
  }

  private async getScreenSize(): Promise<{
    override: string;
    physical: string;
    orientation: number; // 0=portrait, 1=landscape, 2=reverse portrait, 3=reverse landscape
  }> {
    const adb = await this.getAdb();
    const stdout = await adb.shell(['wm', 'size']);
    const size = {
      override: '',
      physical: '',
    };

    // First try to get Override size
    const overrideSize = new RegExp(/Override size: ([^\r?\n]+)*/g).exec(
      stdout,
    );
    if (overrideSize && overrideSize.length >= 2 && overrideSize[1]) {
      debugPage(`Using Override size: ${overrideSize[1].trim()}`);
      size.override = overrideSize[1].trim();
    }

    // If Override size doesn't exist, fallback to Physical size
    const physicalSize = new RegExp(/Physical size: ([^\r?\n]+)*/g).exec(
      stdout,
    );
    if (physicalSize && physicalSize.length >= 2) {
      debugPage(`Using Physical size: ${physicalSize[1].trim()}`);
      size.physical = physicalSize[1].trim();
    }

    let orientation = 0;
    try {
      const orientationStdout = await adb.shell(
        'dumpsys input | grep SurfaceOrientation',
      );
      const orientationMatch = orientationStdout.match(
        /SurfaceOrientation:\s*(\d)/,
      );
      orientation = orientationMatch ? Number(orientationMatch[1]) : 0;
      debugPage(`Screen orientation: ${orientation}`);
    } catch (e) {
      debugPage('Failed to get orientation, default to 0');
    }

    if (size.override || size.physical) {
      return { ...size, orientation };
    }

    throw new Error(`Failed to get screen size, output: ${stdout}`);
  }

  async size(): Promise<Size> {
    if (this.screenSize) {
      return this.screenSize;
    }

    const adb = await this.getAdb();

    // Use custom getScreenSize method instead of adb.getScreenSize()
    const screenSize = await this.getScreenSize();
    // screenSize is a string like "width x height"

    // handle string format "width x height"
    const match = (screenSize.override || screenSize.physical).match(
      /(\d+)x(\d+)/,
    );
    if (!match || match.length < 3) {
      throw new Error(`Unable to parse screen size: ${screenSize}`);
    }

    const isLandscape =
      screenSize.orientation === 1 || screenSize.orientation === 3;
    const width = Number.parseInt(match[isLandscape ? 2 : 1], 10);
    const height = Number.parseInt(match[isLandscape ? 1 : 2], 10);

    // Get device display density
    const densityNum = await adb.getScreenDensity();
    // Standard density is 160, calculate the ratio
    this.deviceRatio = Number(densityNum) / 160;

    // calculate logical pixel size using reverseAdjustCoordinates function
    const { x: logicalWidth, y: logicalHeight } = this.reverseAdjustCoordinates(
      width,
      height,
    );

    this.screenSize = {
      width: logicalWidth,
      height: logicalHeight,
    };

    return this.screenSize;
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

  async screenshotBase64(): Promise<string> {
    debugPage('screenshotBase64 begin');
    const { width, height } = await this.size();
    const adb = await this.getAdb();
    let screenshotBuffer;

    try {
      screenshotBuffer = await adb.takeScreenshot(null);

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
        // Take a screenshot and save it locally
        await adb.shell(`