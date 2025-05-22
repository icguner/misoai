/**
 * Example for using misoai-android with Sauce Labs
 */
import {
  agentFromSauceLabs,
  type SauceLabsConfig,
  type AppiumBaseCapabilities,
  type SauceLabsCapabilities
} from 'misoai-android';

async function main() {
  try {
    console.log('Starting Sauce Labs Android automation example...');

    // Define Sauce Labs configuration
    // Replace with your actual Sauce Labs credentials
    const sauceConfig: SauceLabsConfig = {
      user: process.env.SAUCE_USERNAME || 'your-username',
      key: process.env.SAUCE_ACCESS_KEY || 'your-access-key',
      region: 'us-west-1'
    };

    // Define capabilities for the Android device
    const capabilities: AppiumBaseCapabilities & SauceLabsCapabilities = {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:platformVersion': '12.0',
      'appium:deviceName': 'Samsung Galaxy S21',
      'sauce:options': {
        build: `acabAI Android Test ${new Date().toISOString()}`,
        name: 'Android Automation Example',
        appiumVersion: '2.0.0'
      }
    };

    // Create an agent using Sauce Labs
    console.log('Connecting to Sauce Labs...');
    const agent = await agentFromSauceLabs(sauceConfig, capabilities);

    // Launch the Chrome browser
    console.log('Launching Chrome browser...');
    await agent.launch('com.android.chrome');

    // Open a URL
    console.log('Opening acabAI website...');
    await agent.page.openUrl('https://acabai.com');

    // Take a screenshot
    console.log('Taking a screenshot...');
    const screenshot = await agent.page.screenshotBase64();
    console.log('Screenshot taken:', screenshot.substring(0, 50) + '...');

    // Get screen size
    const size = await agent.page.size();
    console.log('Screen size:', size);

    // Scroll down
    console.log('Scrolling down...');
    await agent.page.scrollDown(500);

    // Wait for 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Scroll up
    console.log('Scrolling up...');
    await agent.page.scrollUp(300);

    // Wait for 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Close the browser
    console.log('Closing the browser...');
    await agent.page.back();

    // Disconnect from Sauce Labs
    console.log('Disconnecting from Sauce Labs...');
    await agent.page.disconnect();

    console.log('Example completed successfully!');
  } catch (error) {
    console.error('Error in Sauce Labs Android automation example:', error);
  }
}

// Run the example
main().catch(console.error);
