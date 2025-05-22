import { agentFromAdbDevice } from '../src';

/**
 * Example of using remote ADB connection
 *
 * To run this example:
 * 1. Make sure you have a remote ADB server running
 * 2. Update the options below with your remote ADB server details
 * 3. Run with: ts-node remote-adb.ts
 */
async function main() {
  try {
    // Connect to a remote ADB server
    const agent = await agentFromAdbDevice(undefined, {
      adbConnectionOptions: {
        host: '192.168.1.100', // Replace with your remote ADB server IP
        port: 5037             // Replace with your remote ADB server port if not default
      }
    });

    // Launch the settings app
    await agent.launch('com.android.settings');

    // Take a screenshot
    const screenshot = await agent.page.screenshotBase64();
    console.log('Screenshot taken:', screenshot.substring(0, 50) + '...');

    // Get device size
    const size = await agent.page.size();
    console.log('Device size:', size);

    // Click on the center of the screen
    await agent.page.mouse.click(size.width / 2, size.height / 2);

    console.log('Example completed successfully');
  } catch (error) {
    console.error('Error running example:', error);
  }
}

main();
