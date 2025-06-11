/**
 * Example for using @acabai/android with a custom Appium server (hub URL)
 */
import {
  type AppiumBaseCapabilities,
  type AppiumServerConfig,
  agentFromAppiumServer,
} from '@acabai/android';
import { overrideAIConfig } from '@acabai/shared/env';

async function main() {
  try {
    console.log('Starting custom Appium server example...');

    // Configure AI settings (if using AI features)
    // Replace with your actual API key
    overrideAIConfig({
      apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
      model: 'gpt-4-vision-preview',
      temperature: 0.2,
      maxTokens: 4096,
    });

    // Define custom Appium server configuration
    // Replace with your actual Appium server details
    const serverConfig: AppiumServerConfig = {
      hostname: process.env.APPIUM_HOST || 'localhost',
      port: Number.parseInt(process.env.APPIUM_PORT || '4723'),
      path: process.env.APPIUM_PATH || '/wd/hub',
      protocol: (process.env.APPIUM_PROTOCOL || 'http') as 'http' | 'https',
    };

    console.log(
      `Connecting to Appium server at ${serverConfig.protocol}://${serverConfig.hostname}:${serverConfig.port}${serverConfig.path}`,
    );

    // Define capabilities for the Android device
    const capabilities: AppiumBaseCapabilities = {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': 'Android Device',
      // Uncomment and set your device ID if you have multiple devices connected
      // 'appium:udid': 'your_device_id_here',
      'appium:autoGrantPermissions': true,
    };

    // Create an agent using the custom Appium server
    const agent = await agentFromAppiumServer(serverConfig, capabilities);

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

    // Use AI to find and tap on the "Wi-Fi" option (if using AI features)
    console.log('Using AI to find and tap on Wi-Fi...');
    await agent.aiAction('Find and tap on the Wi-Fi option');

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
    console.error('Error in custom Appium server example:', error);
  }
}

// Run the example
main().catch(console.error);
