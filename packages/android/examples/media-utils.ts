/**
 * Example demonstrating the media utility functions in misoai-android
 *
 * This example shows how to:
 * 1. Take screenshots
 * 2. Record video
 * 3. Use other media-related utilities
 */

import { existsSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import {
  type AppiumBaseCapabilities,
  agentFromLocalAppium,
  startVideoRecording,
  stopVideoRecording,
  takeScreenshot,
} from 'misoai-android';

async function main() {
  try {
    console.log('Starting Android media utilities example...');

    // Define capabilities for the Android device
    const capabilities: AppiumBaseCapabilities = {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'Android Device',
      // Uncomment and set your device ID if you have multiple devices connected
      // 'appium:udid': 'your_device_id_here',
      'appium:autoGrantPermissions': true,
    };

    // Create an agent using the local Appium server
    console.log('Connecting to local Appium server...');
    const agent = await agentFromLocalAppium(capabilities);

    // Create directories for screenshots and videos
    const screenshotsDir = path.join(__dirname, 'screenshots');
    const videosDir = path.join(__dirname, 'videos');

    if (!existsSync(screenshotsDir)) {
      mkdirSync(screenshotsDir, { recursive: true });
    }

    if (!existsSync(videosDir)) {
      mkdirSync(videosDir, { recursive: true });
    }

    // Launch the settings app
    console.log('Launching Android Settings app...');
    await agent.launch('com.android.settings');

    // Take a screenshot and save it to a file
    console.log('Taking a screenshot...');
    const screenshotPath = path.join(screenshotsDir, 'settings-home.png');
    await takeScreenshot(agent.page, { filePath: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);

    // Start recording video
    console.log('Starting video recording...');
    await startVideoRecording(agent.page, {
      timeLimit: 30, // 30 seconds max
      bitRate: 6000000, // 6 Mbps
    });

    // Perform some actions while recording
    console.log('Performing actions while recording...');

    // Scroll down
    await agent.page.scrollDown(300);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

    // Scroll up
    await agent.page.scrollUp(300);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

    // Use AI to find and tap on an element
    await agent.aiAction('Find and tap on the Network & Internet option');
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

    // Take another screenshot
    console.log('Taking another screenshot...');
    const screenshotPath2 = path.join(screenshotsDir, 'network-settings.png');
    await takeScreenshot(agent.page, { filePath: screenshotPath2 });
    console.log(`Screenshot saved to ${screenshotPath2}`);

    // Go back
    await agent.page.back();
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

    // Stop recording and save the video
    console.log('Stopping video recording...');
    const videoPath = path.join(videosDir, 'settings-navigation.mp4');
    await stopVideoRecording(agent.page, { filePath: videoPath });
    console.log(`Video saved to ${videoPath}`);

    // Disconnect from the device
    console.log('Disconnecting from device...');
    await agent.page.disconnect();

    console.log('Example completed successfully!');
  } catch (error: any) {
    console.error('Error in example:', error.message);
    process.exit(1);
  }
}

// Run the example
main();
