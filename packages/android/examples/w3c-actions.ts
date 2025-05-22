/**
 * Example for using misoai-android with W3C Actions API
 *
 * This example demonstrates how to use the W3C Actions API for touch interactions
 * after migrating from the deprecated TouchAction API.
 */
import { agentFromLocalAppium, type AppiumBaseCapabilities } from 'misoai-android';

async function main() {
  try {
    console.log('Starting W3C Actions API Android automation example...');

    // Define capabilities for the Android device
    const capabilities: AppiumBaseCapabilities = {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'Android Device',
      // Uncomment and set your device ID if you have multiple devices connected
      // 'appium:udid': 'your_device_id_here',
      'appium:autoGrantPermissions': true
    };

    // Create an agent using the local Appium server
    console.log('Connecting to local Appium server...');
    const agent = await agentFromLocalAppium(capabilities);

    // Launch the settings app
    console.log('Launching Android Settings app...');
    await agent.launch('com.android.settings');

    // Get screen size
    const size = await agent.page.size();
    console.log('Screen size:', size);

    // Perform a tap in the middle of the screen using W3C Actions API
    console.log('Tapping in the middle of the screen...');
    await agent.page.tap(size.width / 2, size.height / 2);

    // Wait for 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Perform a swipe from bottom to top (scroll up) using W3C Actions API
    console.log('Swiping from bottom to top (scroll up)...');
    await agent.page.swipe(
      size.width / 2,      // startX (middle of screen)
      size.height * 0.8,   // startY (near bottom)
      size.width / 2,      // endX (same horizontal position)
      size.height * 0.2,   // endY (near top)
      800                  // duration in ms
    );

    // Wait for 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Perform a swipe from top to bottom (scroll down) using W3C Actions API
    console.log('Swiping from top to bottom (scroll down)...');
    await agent.page.swipe(
      size.width / 2,      // startX (middle of screen)
      size.height * 0.2,   // startY (near top)
      size.width / 2,      // endX (same horizontal position)
      size.height * 0.8,   // endY (near bottom)
      800                  // duration in ms
    );

    // Wait for 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Perform a swipe from right to left (scroll left) using W3C Actions API
    console.log('Swiping from right to left (scroll left)...');
    await agent.page.swipe(
      size.width * 0.8,    // startX (near right)
      size.height / 2,     // startY (middle of screen)
      size.width * 0.2,    // endX (near left)
      size.height / 2,     // endY (same vertical position)
      800                  // duration in ms
    );

    // Wait for 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Perform a swipe from left to right (scroll right) using W3C Actions API
    console.log('Swiping from left to right (scroll right)...');
    await agent.page.swipe(
      size.width * 0.2,    // startX (near left)
      size.height / 2,     // startY (middle of screen)
      size.width * 0.8,    // endX (near right)
      size.height / 2,     // endY (same vertical position)
      800                  // duration in ms
    );

    // Wait for 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Type some text using W3C Actions API
    console.log('Typing text using W3C Actions API...');
    // First tap to focus on a search field if available
    await agent.page.tap(size.width / 2, size.height * 0.1);
    await agent.page.keyboard.type('Hello W3C Actions');

    // Wait for 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Press the back button
    console.log('Pressing back button...');
    await agent.page.back();

    // Wait for 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Press the home button
    console.log('Pressing home button...');
    await agent.page.home();

    // Disconnect from the Appium server
    console.log('Disconnecting from Appium server...');
    await agent.page.disconnect();

    console.log('Example completed successfully!');
  } catch (error) {
    console.error('Error in W3C Actions API Android automation example:', error);
  }
}

// Run the example
main().catch(console.error);
