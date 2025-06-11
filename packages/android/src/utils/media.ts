/**
 * Media utility functions for Android automation
 *
 * This module provides helper functions for taking screenshots, recording video,
 * and other media-related operations on Android devices.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { getDebug } from 'misoai-shared/logger';
import type { AppiumDevice } from '../page/appium-device';

const debugMedia = getDebug('android:utils:media');

/**
 * Options for taking a screenshot
 */
export interface ScreenshotOptions {
  /**
   * File path where the screenshot should be saved
   * If not provided, the screenshot will only be returned as base64
   */
  filePath?: string;

  /**
   * Whether to create the directory if it doesn't exist
   * @default true
   */
  createDir?: boolean;

  /**
   * Quality of the screenshot (1-100)
   * Only applicable when saving to a JPEG file
   * @default 90
   */
  quality?: number;

  /**
   * Whether to return the screenshot as base64 data
   * @default true
   */
  returnBase64?: boolean;
}

/**
 * Options for recording video
 */
export interface VideoRecordingOptions {
  /**
   * File path where the video should be saved
   */
  filePath: string;

  /**
   * Whether to create the directory if it doesn't exist
   * @default true
   */
  createDir?: boolean;

  /**
   * Maximum duration of the recording in seconds
   * @default 180 (3 minutes)
   */
  timeLimit?: number;

  /**
   * Bit rate for the video in bits per second
   * @default 4000000 (4 Mbps)
   */
  bitRate?: number;

  /**
   * Video size (width x height) in pixels
   * @default "1280x720"
   */
  size?: string;
}

/**
 * Takes a screenshot of the current screen
 *
 * @param device - AppiumDevice instance
 * @param options - Screenshot options
 * @returns Promise resolving to the screenshot as base64 data (if returnBase64 is true)
 *
 * @example
 * ```typescript
 * // Take a screenshot and save it to a file
 * await takeScreenshot(device, { filePath: 'screenshots/home-screen.png' });
 *
 * // Take a screenshot and get it as base64 data
 * const base64Screenshot = await takeScreenshot(device);
 * ```
 */
export async function takeScreenshot(
  device: AppiumDevice,
  options: ScreenshotOptions = {},
): Promise<string | undefined> {
  const { filePath, createDir = true, returnBase64 = true } = options;

  debugMedia('Taking screenshot');

  try {
    // Get screenshot as base64
    const base64Screenshot = await device.screenshotBase64();

    // Save to file if filePath is provided
    if (filePath) {
      debugMedia(`Saving screenshot to ${filePath}`);

      // Create directory if it doesn't exist
      if (createDir) {
        const dir = path.dirname(filePath);
        if (!existsSync(dir)) {
          debugMedia(`Creating directory ${dir}`);
          mkdirSync(dir, { recursive: true });
        }
      }

      // Remove the data URL prefix and convert to buffer
      const base64Data = base64Screenshot.replace(
        /^data:image\/\w+;base64,/,
        '',
      );
      const buffer = Buffer.from(base64Data, 'base64');

      // Write to file
      writeFileSync(filePath, buffer);
      debugMedia(`Screenshot saved to ${filePath}`);
    }

    // Return base64 data if requested
    if (returnBase64) {
      return base64Screenshot;
    }
  } catch (error: any) {
    debugMedia(`Error taking screenshot: ${error.message}`);
    throw new Error(`Failed to take screenshot: ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * Starts recording the screen
 *
 * @param device - AppiumDevice instance
 * @param options - Video recording options
 * @returns Promise resolving when recording has started
 *
 * @example
 * ```typescript
 * // Start recording video
 * await startVideoRecording(device, {
 *   timeLimit: 60, // 1 minute
 *   bitRate: 6000000 // 6 Mbps
 * });
 *
 * // Perform some actions...
 *
 * // Stop recording and save the video
 * await stopVideoRecording(device, { filePath: 'videos/test-recording.mp4' });
 * ```
 */
export async function startVideoRecording(
  device: AppiumDevice,
  options: Partial<VideoRecordingOptions> = {},
): Promise<void> {
  const { timeLimit = 180, bitRate = 4000000, size = '1280x720' } = options;

  debugMedia('Starting video recording');

  try {
    // Get the WebdriverIO driver
    const driver = await device.getDriver();

    // Start recording
    await driver.startRecordingScreen({
      timeLimit,
      videoSize: size,
      bitRate,
    });

    debugMedia('Video recording started');
  } catch (error: any) {
    debugMedia(`Error starting video recording: ${error.message}`);
    throw new Error(`Failed to start video recording: ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * Stops recording the screen and saves the video
 *
 * @param device - AppiumDevice instance
 * @param options - Video recording options
 * @returns Promise resolving to the video as base64 data
 *
 * @example
 * ```typescript
 * // Stop recording and save the video
 * await stopVideoRecording(device, { filePath: 'videos/test-recording.mp4' });
 * ```
 */
export async function stopVideoRecording(
  device: AppiumDevice,
  options: VideoRecordingOptions,
): Promise<string> {
  const { filePath, createDir = true } = options;

  debugMedia('Stopping video recording');

  try {
    // Get the WebdriverIO driver
    const driver = await device.getDriver();

    // Stop recording and get the base64 video data
    const base64Video = await driver.stopRecordingScreen();

    // Create directory if it doesn't exist
    if (createDir) {
      const dir = path.dirname(filePath);
      if (!existsSync(dir)) {
        debugMedia(`Creating directory ${dir}`);
        mkdirSync(dir, { recursive: true });
      }
    }

    // Write to file
    const buffer = Buffer.from(base64Video, 'base64');
    writeFileSync(filePath, buffer);
    debugMedia(`Video saved to ${filePath}`);

    return base64Video;
  } catch (error: any) {
    debugMedia(`Error stopping video recording: ${error.message}`);
    throw new Error(`Failed to stop video recording: ${error.message}`, {
      cause: error,
    });
  }
}
