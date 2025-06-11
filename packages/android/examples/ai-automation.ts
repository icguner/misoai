/**
 * Example for using misoai-android with AI-powered automation
 */
import {
  type AppiumBaseCapabilities,
  agentFromLocalAppium,
} from 'misoai-android';
import { overrideAIConfig } from 'misoai-shared/env';

async function main() {
  try {
    console.log('Starting AI-powered Android automation example...');

    // Configure AI settings
    // Replace with your actual API key
    overrideAIConfig({
      apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
      model: 'gpt-4-vision-preview',
      temperature: 0.2,
      maxTokens: 4096,
    });

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

    // Use AI to find and tap on the "Wi-Fi" option
    console.log('Using AI to find and tap on Wi-Fi...');
    await agent.aiAction('Find and tap on the Wi-Fi option');

    // Wait for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Use AI to check if Wi-Fi is enabled
    console.log('Using AI to check if Wi-Fi is enabled...');
    const wifiStatus = await agent.aiAssert('Is Wi-Fi enabled?');
    console.log('Wi-Fi status:', wifiStatus);

    // Use AI to go back to the main settings screen
    console.log('Using AI to go back to the main settings screen...');
    await agent.aiAction('Go back to the main settings screen');

    // Use AI to find and tap on the "Display" option
    console.log('Using AI to find and tap on Display settings...');
    await agent.aiAction('Find and tap on the Display option');

    // Wait for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Use AI to check the current brightness level
    console.log('Using AI to check the current brightness level...');
    const brightnessInfo = await agent.aiExtract(
      'What is the current brightness level?',
    );
    console.log('Brightness info:', brightnessInfo);

    // Use AI to go back to the main settings screen
    console.log('Using AI to go back to the main settings screen...');
    await agent.aiAction('Go back to the main settings screen');

    // Press the home button
    console.log('Pressing home button...');
    await agent.page.home();

    // Disconnect from the Appium server
    console.log('Disconnecting from Appium server...');
    await agent.page.disconnect();

    console.log('Example completed successfully!');
  } catch (error) {
    console.error('Error in AI-powered Android automation example:', error);
  }
}

// Run the example
main().catch(console.error);
