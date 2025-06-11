/**
 * Basic usage example for misoai-android with local Appium server
 */
import {
  type AppiumBaseCapabilities,
  agentFromLocalAppium,
} from 'misoai-android';

async function main() {
  try {
    console.log('Starting basic Android automation example...');

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

    // Launch the settings app
    console.log('Launching Android Settings app...');
    await agent.launch('com.android.settings');

    // Take a screenshot
    console.log('Taking a screenshot...');
    const screenshot = await agent.page.screenshotBase64();
    console.log('Screenshot taken:', `${screenshot.substring(0, 50)}...`);

    // Get the current URL (package/activity)
    const currentUrl = await agent.page.url();
    console.log('Current URL:', currentUrl);

    // Get screen size
    const size = await agent.page.size();
    console.log('Screen size:', size);

    // Perform a tap in the middle of the screen
    console.log('Tapping in the middle of the screen...');
    await agent.page.tap(size.width / 2, size.height / 2);

    // Scroll down
    console.log('Scrolling down...');
    await agent.page.scrollDown(300);

    // Wait for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Press the back button
    console.log('Pressing back button...');
    await agent.page.back();

    // Wait for 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Press the home button
    console.log('Pressing home button...');
    await agent.page.home();

    // Disconnect from the Appium server
    console.log('Disconnecting from Appium server...');
    await agent.page.disconnect();

    console.log('Example completed successfully!');
  } catch (error) {
    console.error('Error in Android automation example:', error);
  }
}

// Run the example
main().catch(console.error);
